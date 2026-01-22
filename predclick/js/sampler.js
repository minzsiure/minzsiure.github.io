// sampler.js
import { CFG } from "./config.js";
import { rng, poissonKnuth } from "./rng.js";
import { allowed } from "./bounds.js";

function getSchedule(condition) {
  const c = condition ?? CFG.condition;
  const sched = CFG.schedules?.[c] ?? CFG.schedules?.[CFG.condition];
  if (!sched) throw new Error(`Missing schedule for condition=${c}`);
  return sched; // { lam, prb }
}

/** Evidence trajectory on a grid */
export function evidenceTrajectory(tL, tR, T, dt) {
  const n = Math.floor(T / dt) + 1;
  const ts = new Float32Array(n);
  const E = new Int32Array(n);
  let iL = 0,
    iR = 0,
    e = 0;
  for (let k = 0; k < n; k++) {
    const t = k * dt;
    ts[k] = t;
    while (iL < tL.length && tL[iL] <= t + 1e-12) {
      e -= 1;
      iL++;
    }
    while (iR < tR.length && tR[iR] <= t + 1e-12) {
      e += 1;
      iR++;
    }
    E[k] = e;
  }
  return { ts, E };
}

function sampleCategorical(ps) {
  const u = rng();
  let acc = 0;
  for (let i = 0; i < ps.length; i++) {
    acc += ps[i];
    if (u <= acc) return i;
  }
  return ps.length - 1;
}

function expSample(rate) {
  // exponential with mean 1/rate
  // u in (0,1]
  let u = 1 - rng();
  if (u <= 0) u = 1e-12;
  return -Math.log(u) / rate;
}

function ipiOk(timesSorted, lastTime, minIpi) {
  if (minIpi == null) return true;
  if (!timesSorted || timesSorted.length === 0) return true;
  if (lastTime != null && Number.isFinite(lastTime)) {
    if (timesSorted[0] - lastTime < minIpi) return false;
  }
  for (let i = 1; i < timesSorted.length; i++) {
    if (timesSorted[i] - timesSorted[i - 1] < minIpi) return false;
  }
  return true;
}

function drawFirstStereoTime(T, lamL, lamR) {
  const rate = lamL + lamR;
  if (rate <= 0) return null;
  // repeat until < T (almost always fast)
  for (let k = 0; k < 10000; k++) {
    const t = expSample(rate);
    if (t < T) return t;
  }
  throw new Error("Could not sample t_first < T; check rates/T.");
}

function drawFirstStereoTimeConstrained(T, lamL, lamR, dt, condition) {
  const rate = lamL + lamR;
  if (rate <= 0) return null;

  for (let tries = 0; tries < 20000; tries++) {
    const tFirst = expSample(rate);
    if (tFirst >= T) continue;

    // check e=0 allowed for all times in [0, tFirst] on dt grid
    const n = Math.floor(tFirst / dt);
    let ok = true;
    for (let k = 0; k <= n; k++) {
      const tChk = Math.min(tFirst, k * dt);
      if (!allowed(0, tChk, condition)) {
        ok = false;
        break;
      }
    }
    if (ok && allowed(0, tFirst, condition)) return tFirst;
  }
  throw new Error("Could not sample feasible t_first under gray constraints.");
}

/**
 * Binwise constrained sampler with optional stereo-first-click and optional minIpi.
 * Enforces ONLY gray constraints (allowed()).
 */
export function generateClicksGrayOnlyBinwise(
  T,
  dt,
  maxTriesPerBin,
  condition = CFG.condition
) {
  const { lam, prb } = getSchedule(condition);
  // choose lam pair
  let i;
  if (!prb) {
    i = Math.floor(rng() * lam.length);
  } else {
    const p = prb.slice();
    const s = p.reduce((a, b) => a + b, 0);
    for (let j = 0; j < p.length; j++) p[j] /= s;
    i = sampleCategorical(p);
  }
  const [lamA, lamB] = lam[i];

  // random side assignment per trial
  let lamL, lamR;
  if (rng() < 0.5) {
    lamL = lamA;
    lamR = lamB;
  } else {
    lamL = lamB;
    lamR = lamA;
  }

  // --- Peak switch setup (mirror Python) ---
  const doPeakSwitch =
    CFG.switchLamAfterDiamond &&
    CFG.switchTime != null &&
    CFG.regionEvidenceBoundary != null &&
    condition === "test"; // Python: requires gray_bounds != None; in JS gray-only sampler => treat "test" as constrained

  const kPeak = doPeakSwitch ? Math.round(CFG.switchTime / dt) : null;
  let peakDecisionMade = false;

  // stereo first click
  let tFirst = null;
  if (CFG.firstClickStereo) {
    if (condition !== "test") {
      tFirst = drawFirstStereoTime(T, lamL, lamR);
    } else {
      tFirst = drawFirstStereoTimeConstrained(T, lamL, lamR, dt, condition);
    }
  }

  const nBins = Math.ceil(T / dt);
  const tL_all = [];
  const tR_all = [];
  let e = 0;

  let stereoAdded = false;
  let lastClickTime = null;

  for (let k = 0; k < nBins; k++) {
    const t0 = k * dt;
    const t1 = Math.min(T, (k + 1) * dt);

    // --- at t == switchTime, probabilistically switch rates for the rest of the trial ---
    if (doPeakSwitch && !peakDecisionMade && k === kPeak) {
      const ePeak = e; // evidence at exactly t0 == switch_time (same as Python)

      const lamHi = CFG.lamHiAfterSwitch ?? 26;
      const lamLo = CFG.lamLoAfterSwitch ?? 14;

      const boundary = CFG.regionEvidenceBoundary;
      const pHigh = CFG.pHighRegionLamSwitch ?? 0.2;
      const pLow = CFG.pLowRegionLamSwitch ?? 1.0;

      if (Math.abs(ePeak) > boundary) {
        // R1 or L1
        if (rng() < pHigh) {
          if (ePeak > 0) {
            // too positive -> push leftward: L high, R low
            lamL = lamHi;
            lamR = lamLo;
          } else if (ePeak < 0) {
            // too negative -> push rightward: L low, R high
            lamL = lamLo;
            lamR = lamHi;
          }
        }
      } else {
        // R2 or L2
        if (rng() < pLow) {
          if (ePeak > 0) {
            lamL = lamHi;
            lamR = lamLo;
          } else if (ePeak < 0) {
            lamL = lamLo;
            lamR = lamHi;
          }
        }
      }

      peakDecisionMade = true;
    }

    // if entire bin before tFirst: no unilateral clicks, just feasibility at t1
    if (tFirst != null && t1 <= tFirst) {
      if (!allowed(e, t1, condition)) {
        throw new Error(
          `Constraints violated before t_first at t=${t1.toFixed(3)}`
        );
      }
      continue;
    }

    // bin partially/fully after tFirst
    let subStart = t0;
    if (tFirst != null && t0 < tFirst && tFirst < t1) {
      // forbid unilateral clicks before tFirst in this bin
      subStart = tFirst + 1e-12;
    }

    const dtk = t1 - subStart;
    const hi = t1 - 1e-12;

    let accepted = false;

    for (let tr = 0; tr < maxTriesPerBin; tr++) {
      // unilateral clicks only on [subStart, t1)
      const nL = poissonKnuth(lamL * dtk);
      const nR = poissonKnuth(lamR * dtk);

      const tL = new Array(nL);
      const tR = new Array(nR);
      for (let i = 0; i < nL; i++)
        tL[i] = Math.min(hi, Math.max(subStart, subStart + rng() * dtk));
      for (let i = 0; i < nR; i++)
        tR[i] = Math.min(hi, Math.max(subStart, subStart + rng() * dtk));

      const addStereoNow =
        tFirst != null && !stereoAdded && t0 <= tFirst && tFirst < t1;

      // events sorted by time
      const events = [];
      for (let i = 0; i < nR; i++) events.push([tR[i], +1]);
      for (let i = 0; i < nL; i++) events.push([tL[i], -1]);
      events.sort((a, b) => a[0] - b[0]);

      // IPI check on combined stream (+ stereo if happens now)
      let times = events.map((x) => x[0]);
      if (addStereoNow) times = times.concat([tFirst]);
      times.sort((a, b) => a - b);

      let ok = ipiOk(times, lastClickTime, CFG.minIpi);

      // if stereo in this bin, ensure allowed at tFirst too (same as python)
      if (ok && addStereoNow && !allowed(e, tFirst, condition)) ok = false;

      // apply events sequentially: update e then check allowed (matches your python)
      let eTmp = e;
      if (ok) {
        for (const [tt, de] of events) {
          eTmp += de;
          if (!allowed(eTmp, tt, condition)) {
            ok = false;
            break;
          }
        }
      }

      if (ok && allowed(eTmp, t1, condition)) {
        // accept bin
        if (addStereoNow) {
          tL_all.push(tFirst);
          tR_all.push(tFirst);
          stereoAdded = true;
        }
        for (let i = 0; i < nL; i++) tL_all.push(tL[i]);
        for (let i = 0; i < nR; i++) tR_all.push(tR[i]);
        e = eTmp;

        if (CFG.minIpi != null && times.length > 0) {
          lastClickTime = times[times.length - 1];
        }

        accepted = true;
        break;
      }
    }

    if (!accepted) {
      throw new Error(
        `Could not sample allowed bin at t∈[${t0.toFixed(3)},${t1.toFixed(
          3
        )}], e=${e}`
      );
    }
  }

  tL_all.sort((a, b) => a - b);
  tR_all.sort((a, b) => a - b);

  return {
    tL: tL_all,
    tR: tR_all,
    lamL,
    lamR,
    finalE: tR_all.length - tL_all.length,
  };
}

export function sampleTrial(condition = CFG.condition) {
  const T = CFG.T;

  for (let attempt = 0; attempt < CFG.maxAttempts; attempt++) {
    let out;
    try {
      out = generateClicksGrayOnlyBinwise(
        T,
        CFG.dtCheck,
        CFG.maxTriesPerBin,
        condition
      );
    } catch (e) {
      continue; // restart trial
    }

    if (CFG.avoidTie && out.finalE === 0) continue;

    const trajPlot = evidenceTrajectory(out.tL, out.tR, T, CFG.dtPlot);
    return { ...out, condition, traj: trajPlot };
  }

  throw new Error("Could not sample a valid trial (constraints too tight).");
}
