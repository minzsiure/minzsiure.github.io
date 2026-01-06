import { CFG } from "./config.js";
import { rng, poissonKnuth } from "./rng.js";
import { allowed } from "./bounds.js";

/** ---------------------------
 *  Evidence trajectory on a grid
 *  --------------------------- */
export function evidenceTrajectory(tL, tR, T, dt) {
    const n = Math.floor(T / dt) + 1;
    const ts = new Float32Array(n);
    const E = new Int32Array(n);
    let iL = 0, iR = 0, e = 0;
    for (let k = 0; k < n; k++) {
        const t = k * dt;
        ts[k] = t;
        while (iL < tL.length && tL[iL] <= t + 1e-12) { e -= 1; iL++; }
        while (iR < tR.length && tR[iR] <= t + 1e-12) { e += 1; iR++; }
        E[k] = e;
    }
    return { ts, E };
}

export function checkConstraintsOnGrid(traj) {
    const { ts, E } = traj;
    for (let k = 0; k < ts.length; k++) if (!allowed(E[k], ts[k])) return false;
    return true;
}

/** ---------------------------
 *  Whole-trial rejection sampler
 *  --------------------------- */
export function generateClicksWithConstraintsBinwise(T, lamPair, dt, maxTriesPerBin) {
    const [lamA, lamB] = lamPair;

    // randomly assign per trial (same as Python)
    let lamL, lamR;
    if (rng() < 0.5) { lamL = lamA; lamR = lamB; }
    else { lamL = lamB; lamR = lamA; }

    const nBins = Math.ceil(T / dt);
    const tL_all = [];
    const tR_all = [];
    let e = 0;

    for (let k = 0; k < nBins; k++) {
        const t0 = k * dt;
        const t1 = Math.min(T, (k + 1) * dt);
        const dtk = t1 - t0;
        const dtq = dt;
        const hi = t1 - 1e-12;

        let accepted = false;

        for (let tr = 0; tr < maxTriesPerBin; tr++) {
            const nL = poissonKnuth(lamL * dtk);
            const nR = poissonKnuth(lamR * dtk);

            const tL = new Array(nL);
            const tR = new Array(nR);
            for (let i = 0; i < nL; i++) tL[i] = Math.min(hi, Math.max(t0, Math.round((t0 + rng() * dtk) / dtq) * dtq));
            for (let i = 0; i < nR; i++) tR[i] = Math.min(hi, Math.max(t0, Math.round((t0 + rng() * dtk) / dtq) * dtq));

            // events = [(tR,+1), (tL,-1)], sorted by time (same as Python)
            const events = [];
            for (let i = 0; i < nR; i++) events.push([tR[i], +1, "R"]);
            for (let i = 0; i < nL; i++) events.push([tL[i], -1, "L"]);
            events.sort((a, b) => a[0] - b[0]);

            let e_tmp = e;
            let ok = true;

            for (const [tt, de] of events) {
                e_tmp += de; // IMPORTANT: update first, then check (matches Python)
                if (!allowed(e_tmp, tt)) { ok = false; break; }
            }

            if (ok && allowed(e_tmp, t1)) {
                // accept bin
                for (let i = 0; i < nL; i++) tL_all.push(tL[i]);
                for (let i = 0; i < nR; i++) tR_all.push(tR[i]);
                e = e_tmp;
                accepted = true;
                break;
            }
        }

        if (!accepted) {
            throw new Error(`Could not sample an allowed bin at t∈[${t0.toFixed(3)},${t1.toFixed(3)}]`);
        }
    }

    tL_all.sort((a, b) => a - b);
    tR_all.sort((a, b) => a - b);
    return { tL: tL_all, tR: tR_all, lamL, lamR, finalE: (tR_all.length - tL_all.length) };
}

export function sampleTrial() {
    const T = CFG.T;

    for (let attempt = 0; attempt < CFG.maxAttempts; attempt++) {
        let out;
        try {
            out = generateClicksWithConstraintsBinwise(
                T,
                CFG.lamPair,
                CFG.dtCheck,                 // use same dt for constraints as Python
                CFG.maxTriesPerBin           // max_tries_per_bin (match Python default)
            );
        } catch (e) {
            continue; // restart whole trial if any bin fails
        }

        if (CFG.avoidTie && out.finalE === 0) continue;

        const trajPlot = evidenceTrajectory(out.tL, out.tR, T, CFG.dtPlot);
        return { ...out, traj: trajPlot };
    }

    throw new Error("Could not sample a valid trial (constraints too tight).");
}