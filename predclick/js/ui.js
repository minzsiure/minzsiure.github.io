import { CFG } from "./config.js";
import { sampleTrial } from "./sampler.js";
import { playStereoClicks } from "./audio.js";
import { initPlotting } from "./plotting.js";

import { logTrialToSupabase, verifyPassword } from "./api.js";

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export function initApp() {
  /** ---------------------------
   *  DOM
   *  --------------------------- */
    const startBtn = document.getElementById("startBtn");
    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");
    const nextBtn = document.getElementById("nextBtn");
    const sanityBtn = document.getElementById("sanityBtn");

    const statusEl = document.getElementById("status");
    const overlayEl = document.getElementById("revealOverlay");
    const revealBtn = document.getElementById("revealBtn");

    const pwBtn = document.getElementById("pwBtn");
    let loggingArmed = false;
    let adminPassword = null;   // what users typed

    pwBtn.addEventListener("click", async () => {
    const pw = prompt("Enter logging password:");
    if (pw === null) return;

    const candidate = pw.trim();
    if (!candidate) {
        adminPassword = null;
        loggingArmed = false;
        statusEl.textContent = "Logging disabled";
        return;
    }

    statusEl.textContent = "Checking password…";
    pwBtn.disabled = true;

    try {
        await verifyPassword(candidate);
        adminPassword = candidate;
        loggingArmed = true;
        statusEl.textContent = "Logged in ✅";
    } catch (e) {
        adminPassword = null;
        loggingArmed = false;
        statusEl.textContent = "Wrong password ❌";
    } finally {
        pwBtn.disabled = false;
    }
    });


    /** ---------------------------
     *  Canvas plotting
     *  --------------------------- */
    const cv = document.getElementById("cv");
    const plot = initPlotting(cv);

    /** ---------------------------
     *  State
     *  --------------------------- */
    let current = null;
    let awaitingResponse = false;
    let choice = null;
    let revealed = false;

    let trialIndex = 0;
    let audioStartMs = null;

    /** ---------------------------
     *  UI helpers
     *  --------------------------- */
    function setButtons({ start, lr, next, reveal }) {
        startBtn.disabled = !start;
        leftBtn.disabled = !lr;
        rightBtn.disabled = !lr;
        nextBtn.disabled = !next;
        revealBtn.disabled = !reveal;
    }

    function correctSide(finalE) {
        if (finalE > 0) return "right";
        if (finalE < 0) return "left";
        return "tie";
    }

    function verdictText(choice, correct) {
        if (correct === "tie") return `Tie (final evidence = 0).`;
        return (choice === correct)
            ? `✅ Correct (${correct.toUpperCase()})`
            : `❌ Wrong. Correct was ${correct.toUpperCase()}.`;
    }

    /** ---------------------------
     *  Flow: Trial
     *  --------------------------- */
    async function runTrial() {
        setButtons({ start: false, lr: false, next: false, reveal: false });
        statusEl.textContent = "Sampling a constrained trajectory…";
        audioStartMs = null;

        try { current = sampleTrial();}
        catch (e) {
            current = null;
            statusEl.textContent =
                "Failed to sample a valid trial (constraints may be too tight).";
            setButtons({ start: true, lr: false, next: false, reveal: false });
            return;
        }
        trialIndex += 1; // record valid trials only

        // Hide plot during decision phase
        revealed = false;
        overlayEl.classList.remove("hidden");
        plot.drawBlankPlot();

        // Decision phase: play audio only
        awaitingResponse = true;
        choice = null;
        statusEl.textContent = "Listen…";

        // await playStereoClicks(current.tL, current.tR);
        const audio = playStereoClicks(current.tL, current.tR);
        audioStartMs = audio.audioStartMs;
        await audio.done;

        statusEl.textContent = "Choose: Left or Right.";
        setButtons({ start: false, lr: true, next: false, reveal: false });
    }

    async function finishDecision(userChoice) {
        if (!awaitingResponse || !current) return;
        
        awaitingResponse = false;
        choice = userChoice;

        const responseMs = Date.now();
        const audioMs = audioStartMs ?? null;

        // If audioStartMs was never set, don't log (something went wrong)
        if (audioMs === null) {
            statusEl.textContent = "Internal error: missing audio start time.";
            setButtons({ start: true, lr: false, next: false, reveal: false });
            return;
        }

        const correct = correctSide(current.finalE);
        const success = (correct !== "tie") && (userChoice === correct);

        const row = {
            trial_index: trialIndex,

            // readable timestamps
            audio_start_iso: new Date(audioMs).toISOString(),
            response_iso: new Date(responseMs).toISOString(),

            // ms for analysis
            rt_ms: responseMs - audioMs,

            // rates
            lam_pair: CFG.lamPair,
            lam_l: current.lamL,
            lam_r: current.lamR,

            // click trains (seconds-from-trial-start)
            left_clicks_s: Array.from(current.tL),
            right_clicks_s: Array.from(current.tR),

            correct_choice: correct,
            user_choice: userChoice,
            success,
        };
        
        if (loggingArmed && adminPassword) {
            try {
                await logTrialToSupabase({ password: adminPassword, row });
            } catch (e) {
                console.error(e);
                statusEl.textContent += "  (DB save failed; see console.)";
            }
        }

        statusEl.textContent = verdictText(choice, correct) + "  (Click Reveal to see the trajectory.)";

        // enable reveal button; keep overlay up
        setButtons({ start: false, lr: false, next: false, reveal: true });
    }

    async function doReveal() {
        if (!current || revealed) return;
        revealed = true;

        // hide overlay, then replay audio AND draw live trajectory
        overlayEl.classList.add("hidden");

        // animate draw during playback
        let t0 = performance.now();
        let running = true;
        const animate = () => {
            if (!running) return;
            const elapsed = (performance.now() - t0) / 1000;
            const frac = Math.min(1, elapsed / CFG.T);
            plot.drawTrajectory(current, frac);
            if (frac < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        const audio = playStereoClicks(current.tL, current.tR);
        await audio.done;

        running = false;
        plot.drawTrajectory(current, 1.0);

        // allow next
        setButtons({ start: false, lr: false, next: true, reveal: false });
        statusEl.textContent += "  (Reveal complete.)";
    }

    function resetToStart() {
        current = null;
        awaitingResponse = false;
        choice = null;
        revealed = false;

        overlayEl.classList.remove("hidden");
        revealBtn.disabled = true;
        plot.drawBlankPlot();

        statusEl.textContent = "Press Start.";
        setButtons({ start: true, lr: false, next: false, reveal: false });
    }

    /** ---------------------------
    *  Flow: Sanity check
    *  --------------------------- */
    async function runSanityCheck(N = 1000) {
        // hide overlay + disable task buttons while running
        overlayEl.classList.add("hidden");
        setButtons({ start: false, lr: false, next: false, reveal: false });

        statusEl.textContent = `Sanity check: sampling ${N} trajectories…`;

        // draw base once
        const base = plot.plotStateSpaceBaseFixedYRange();

        // sample + draw in batches so the UI doesn’t freeze
        const batch = 25;
        let ok = 0;
        let fail = 0;

        for (let i = 0; i < N; i++) {
            try {
                const tr = sampleTrial(); // uses YOUR constrained sampler
                plot.drawTrajectoryOnBase(base, tr, 0.15, 1);
                ok++;
            } catch (e) {
                fail++;
            }

            if ((i + 1) % batch === 0) {
                statusEl.textContent = `Sanity check: ${i + 1}/${N} done · ok=${ok} · fail=${fail}`;
                await sleep(0); // yield to browser
            }
        }

        statusEl.textContent = `Sanity check complete · ok=${ok} · fail=${fail}`;
        setButtons({ start: true, lr: false, next: false, reveal: false });
    }

    startBtn.addEventListener("click", () => runTrial());
    leftBtn.addEventListener("click", () => finishDecision("left"));
    rightBtn.addEventListener("click", () => finishDecision("right"));
    revealBtn.addEventListener("click", () => doReveal());
    nextBtn.addEventListener("click", () => resetToStart());
    sanityBtn.addEventListener("click", () => runSanityCheck(1000));

    // init
    resetToStart();
}