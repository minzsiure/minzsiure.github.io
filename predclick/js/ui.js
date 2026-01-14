import { CFG } from "./config.js";
import { sampleTrial } from "./sampler.js";
import { playStereoClicks } from "./audio.js";
import { initPlotting } from "./plotting.js";
import { rng } from "./rng.js";

import { signUpUsername, signInUsername, signOut, getSession } from "./auth.js";
import { logTrialToSupabase, verifyPassword } from "./api.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function initApp() {
  const FRIEND_MODE = true;

  /** ---------------------------
   *  DOM
   *  --------------------------- */
  const sessionId = crypto.randomUUID();

  const startBtn = document.getElementById("startBtn");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const nextBtn = document.getElementById("nextBtn");
  const sanityBtn = document.getElementById("sanityBtn");
  const startSessionBtn = document.getElementById("startSessionBtn");

  const statusEl = document.getElementById("status");
  const overlayEl = document.getElementById("revealOverlay");
  const revealBtn = document.getElementById("revealBtn");

  // --- auth UI
  const authStatusEl = document.getElementById("authStatus");
  const signInBtn = document.getElementById("signInBtn");
  const signUpBtn = document.getElementById("signUpBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  // data logging UI
  const pwBtn = document.getElementById("pwBtn");
  const logToggleWrap = document.getElementById("logToggleWrap");
  const logToggle = document.getElementById("logToggle");
  let adminPassword = null; // what users typed
  let passwordVerified = false;
  let loggingEnabled = false;

  let session = null;
  let sessionJustConcluded = false;

  /** ---------------------------
   *  User authentification
   *  --------------------------- */
  //   // Force sign-out on every page load / refresh
  //   (async () => {
  //     try {
  //       await signOut();
  //     } catch (e) {
  //       // ignore (e.g. already signed out)
  //     }
  //   })();

  async function refreshAuthUI() {
    session = await getSession();

    if (session) {
      const username =
        session.user?.user_metadata?.username ??
        session.user?.email?.split("@")?.[0] ??
        "user";

      authStatusEl.textContent = `Signed in: ${username}`;
      signOutBtn.style.display = "inline-block";
      signInBtn.style.display = "none";
      signUpBtn.style.display = "none";
    } else {
      authStatusEl.textContent = "Anonymous";
      signOutBtn.style.display = "none";
      signInBtn.style.display = "inline-block";
      signUpBtn.style.display = "inline-block";
    }
  }
  refreshAuthUI();

  function disableBtn(btn, labelSuffix = "") {
    if (!btn) return;
    btn.disabled = true;
    btn.title = labelSuffix ? `Disabled (${labelSuffix})` : "Disabled";
    btn.style.opacity = "0.45";
    btn.style.cursor = "not-allowed";
  }

  function hideEl(el) {
    if (!el) return;
    el.style.display = "none";
  }

  if (FRIEND_MODE) {
    // Disable “power-user” controls
    disableBtn(sanityBtn, "friend mode");
    // If you also want them to not start a session:
    // disableBtn(startSessionBtn, "friend mode");

    // Kill reveal entirely (prevents clicking reveal + hides the overlay button)
    disableBtn(revealBtn, "friend mode");
    hideEl(overlayEl); // hides overlay + reveal button
    // If you prefer to keep overlay (blank plot) but hide just the reveal button:
    // hideEl(revealBtn);

    // Hide logging toggle UI if it might confuse them
    hideEl(logToggleWrap);

    // Optional: also hide auth UI if you don’t want them signing in/out
    // hideEl(signInBtn); hideEl(signUpBtn); hideEl(signOutBtn);
  }

  // ---- password button
  pwBtn.addEventListener("click", async () => {
    const pw = prompt("Enter logging password:");
    if (pw === null) return;

    const candidate = pw.trim();
    if (!candidate) return;

    statusEl.textContent = "Checking password…";
    pwBtn.disabled = true;

    try {
      await verifyPassword(candidate);

      adminPassword = candidate;
      passwordVerified = true;

      // show toggle, default ON
      logToggleWrap.style.display = "inline-flex";
      logToggle.checked = true;
      loggingEnabled = true;

      statusEl.textContent = "Password ok ✅  Data logging ON";
      pwBtn.textContent = "Password ✓";
      pwBtn.disabled = true; // lock password button after success
    } catch (e) {
      adminPassword = null;
      passwordVerified = false;
      loggingEnabled = false;
      logToggleWrap.style.display = "none";

      statusEl.textContent = "Wrong password ❌";
      pwBtn.disabled = false; // allow retry
    }
  });

  // ---- auth buttons
  signUpBtn.addEventListener("click", async () => {
    const username = prompt("Choose a username:");
    if (!username) return;
    const password = prompt("Choose a password:");
    if (!password) return;

    statusEl.textContent = "Signing up…";
    try {
      await signUpUsername(username.trim(), password);
      statusEl.textContent = "Sign-up ok ✅  Now sign in.";
      await refreshAuthUI(); // session may or may not exist depending on email confirm settings
    } catch (e) {
      console.error(e);
      statusEl.textContent = `Sign-up failed: ${e.message ?? e}`;
    }
  });

  signInBtn.addEventListener("click", async () => {
    const username = prompt("Username:");
    if (!username) return;
    const password = prompt("Password:");
    if (!password) return;

    statusEl.textContent = "Signing in…";
    try {
      await signInUsername(username.trim(), password);
      statusEl.textContent = "Signed in ✅";
      await refreshAuthUI();
    } catch (e) {
      console.error(e);
      statusEl.textContent = `Sign-in failed: ${e.message ?? e}`;
    }
  });

  signOutBtn.addEventListener("click", async () => {
    statusEl.textContent = "Signing out…";
    try {
      await signOut();
      statusEl.textContent = "Signed out.";
      await refreshAuthUI();
    } catch (e) {
      console.error(e);
      statusEl.textContent = `Sign-out failed: ${e.message ?? e}`;
    }
  });

  logToggle.addEventListener("change", () => {
    loggingEnabled = logToggle.checked;
    if (passwordVerified) {
      statusEl.textContent = loggingEnabled ? "Logging ON" : "Logging OFF";
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

  // --- session state ---
  let inSession = false;
  let sessionN = 0; // trials per block
  let sessionTotal = 0; // 2N
  let sessionDone = 0; // completed trials in session
  let blockOrder = null; // ["control","test"] or ["test","control"]
  let blockIndex = 0; // 0 or 1
  let withinBlockDone = 0; // 0..N
  let sessionIndex = 0; // counts sessions started this page load (optional)
  let currentCondition = null; // condition for current trial

  function nextSessionCondition() {
    if (!inSession) return CFG.condition; // fallback
    return blockOrder[blockIndex];
  }
  function advanceSessionCounters() {
    if (!inSession) return;

    sessionDone += 1;
    withinBlockDone += 1;

    if (withinBlockDone >= sessionN) {
      blockIndex += 1;
      withinBlockDone = 0;
    }

    if (sessionDone >= sessionTotal) {
      inSession = false;
      currentCondition = null;
      sessionJustConcluded = true; // <--- add this
      statusEl.textContent = "Session concluded ✅";
      setButtons({
        start: true,
        startSession: true,
        lr: false,
        next: false,
        reveal: false,
      });
    }
  }
  async function startSessionFlow() {
    if (inSession) return;

    const raw = prompt("How many trials per block? (e.g., 200)");
    if (raw == null) return;

    const N = parseInt(raw, 10);
    if (!Number.isFinite(N) || N <= 0) {
      statusEl.textContent = "Invalid number of trials.";
      return;
    }
    sessionJustConcluded = false;

    // initialize session
    inSession = true;
    sessionN = N;
    sessionTotal = 2 * N;
    sessionDone = 0;
    blockIndex = 0;
    withinBlockDone = 0;
    sessionIndex += 1;

    // randomize order
    blockOrder = rng() < 0.5 ? ["control", "test"] : ["test", "control"];

    statusEl.textContent = `Session started. (${sessionTotal} trials total)`;

    // kick off first trial
    // await runTrial(); // runTrial will pick condition from session state
    statusEl.textContent = `Session started. (${sessionTotal} trials total). Press Start to begin.`;
    setButtons({
      start: true, // ✅ enable Start
      startSession: false, // ✅ prevent starting another session
      lr: false,
      next: false,
      reveal: false,
    });
    resetToStart(); // optional, but makes UI consistent
    return;
  }

  /** ---------------------------
   *  UI helpers
   *  --------------------------- */
  function setButtons({
    start = false,
    lr = false,
    next = false,
    reveal = false,
    startSession = false,
  } = {}) {
    startBtn.disabled = !start;
    startSessionBtn.disabled = !startSession;
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
    return choice === correct
      ? `✅ Correct (${correct.toUpperCase()})`
      : `❌ Wrong. Correct was ${correct.toUpperCase()}.`;
  }

  /** ---------------------------
   *  Flow: Trial
   *  --------------------------- */
  async function runTrial() {
    if (awaitingResponse) return;
    sessionJustConcluded = false;

    setButtons({ start: false, lr: false, next: false, reveal: false });
    statusEl.textContent = "Sampling a constrained trajectory…";
    audioStartMs = null;

    try {
      currentCondition = nextSessionCondition(); // "control" or "test" (or CFG.condition)
      current = sampleTrial(currentCondition);
    } catch (e) {
      current = null;
      statusEl.textContent =
        "Failed to sample a valid trial (constraints may be too tight).";
      setButtons({
        start: true,
        startSession: !inSession,
        lr: false,
        next: false,
        reveal: false,
      });
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
    const cond = current?.condition ?? currentCondition ?? CFG.condition;
    const sess = inSession;
    const sessIndex = sess ? sessionIndex : null;
    const blkIndexForThisTrial = sess ? blockIndex : null; // 0/1
    const withinBlockForThisTrial = sess ? withinBlockDone + 1 : null; // 1..N
    const totalInSessionForThisTrial = sess ? sessionDone + 1 : null; // 1..2N

    const responseMs = Date.now();
    const audioMs = audioStartMs ?? null;

    // If audioStartMs was never set, don't log (something went wrong)
    if (audioMs === null) {
      statusEl.textContent = "Internal error: missing audio start time.";
      setButtons({ start: true, lr: false, next: false, reveal: false });
      return;
    }

    const correct = correctSide(current.finalE);
    const success = correct !== "tie" && userChoice === correct;

    const row = {
      condition: cond,
      session_uuid: sessionId, // your per-page UUID
      session_index: sessIndex,
      block_index: blkIndexForThisTrial,
      trial_in_block: withinBlockForThisTrial,
      trial_in_session: totalInSessionForThisTrial,

      trial_index: trialIndex,

      // readable timestamps
      audio_start_iso: new Date(audioMs).toISOString(),
      response_iso: new Date(responseMs).toISOString(),

      // ms for analysis
      rt_ms: responseMs - audioMs,

      // rates
      lam_l: current.lamL,
      lam_r: current.lamR,

      lam_pair: [current.lamL, current.lamR],

      // click trains (seconds-from-trial-start)
      left_clicks_s: Array.from(current.tL),
      right_clicks_s: Array.from(current.tR),

      correct_choice: correct,
      user_choice: userChoice,
      success,
    };

    const s = await getSession(); // always fresh
    const accessToken = s?.access_token ?? null;

    if (!accessToken) row.session_id = sessionId; // required for debug table

    if (passwordVerified && loggingEnabled && adminPassword) {
      (async () => {
        try {
          await logTrialToSupabase({
            password: adminPassword,
            row,
            accessToken,
          });
        } catch (e) {
          console.error(e);
          // don’t block user; optionally show a non-blocking message
          statusEl.textContent += "  (DB save failed; see console.)";
        }
      })();
    }

    statusEl.textContent =
      verdictText(choice, correct) +
      (inSession ? "" : "  (Click Reveal to see the trajectory.)");

    // enable reveal button; keep overlay up
    const allowReveal = !FRIEND_MODE && !inSession;
    setButtons({ start: false, lr: false, next: true, reveal: allowReveal });
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

    if (!sessionJustConcluded) {
      statusEl.textContent = inSession
        ? "Session active. Press Start."
        : "Press Start.";
    }

    setButtons({
      start: true,
      startSession: !inSession,
      lr: false,
      next: false,
      reveal: false,
    });
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
        statusEl.textContent = `Sanity check: ${
          i + 1
        }/${N} done · ok=${ok} · fail=${fail}`;
        await sleep(0); // yield to browser
      }
    }

    statusEl.textContent = `Sanity check complete · ok=${ok} · fail=${fail}`;
    setButtons({ start: true, lr: false, next: false, reveal: false });
  }

  startBtn.addEventListener("click", () => runTrial());
  leftBtn.addEventListener("click", () => finishDecision("left"));
  rightBtn.addEventListener("click", () => finishDecision("right"));
  if (!FRIEND_MODE) {
    revealBtn.addEventListener("click", () => {
      if (inSession) return; // stay blind
      doReveal();
    });
  }

  nextBtn.addEventListener("click", () => {
    // advance only if we actually completed a trial (i.e., we have a recorded current + answered)
    if (current && !awaitingResponse) {
      advanceSessionCounters();
    }

    resetToStart();

    if (inSession) {
      runTrial();
    }
  });
  if (!FRIEND_MODE) {
    sanityBtn.addEventListener("click", () => runSanityCheck(1000));
  }

  startSessionBtn.addEventListener("click", () => startSessionFlow());

  // ---- keyboard support: left/right arrows select choice; Space = Start / Next ----
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      el.isContentEditable
    );
  }

  function isEnabled(btn) {
    return !!btn && btn.disabled === false;
  }

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    if (isTypingTarget(ev.target)) return;

    // Choice keys (only when awaiting response)
    if (awaitingResponse && current) {
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        finishDecision("left");
        return;
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        finishDecision("right");
        return;
      }
    }

    // Space = Start (if enabled) else Next (if enabled)
    if (ev.key === " " || ev.code === "Space") {
      ev.preventDefault();

      // Prefer Start if it's enabled; otherwise Next
      if (isEnabled(startBtn)) {
        runTrial();
      } else if (isEnabled(nextBtn)) {
        nextBtn.click(); // reuse existing logic exactly
      }
    }
  });

  resetToStart();
}
