import { CFG } from "./config.js";

/** ---------------------------
 *  WebAudio (stereo click scheduling)
 *  --------------------------- */
let audioCtx = null;
export function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

export function scheduleClick(ctx, when, panVal) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = CFG.freqHz;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, when);

    const dur = CFG.clickMs / 1000.0;
    gain.gain.linearRampToValueAtTime(CFG.amp, when + 0.0008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    let pan;
    if (ctx.createStereoPanner) {
        pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(panVal, when);
    }

    osc.connect(gain);
    if (pan) gain.connect(pan).connect(ctx.destination);
    else gain.connect(ctx.destination);

    osc.start(when);
    osc.stop(when + dur + 0.02);
}

export function playStereoClicks(tL, tR) {
    const ctx = ensureAudio();
    const start = ctx.currentTime + 0.08;
    for (const t of tL) scheduleClick(ctx, start + t, -1.0);
    for (const t of tR) scheduleClick(ctx, start + t, +1.0);

    const end = start + CFG.T + 0.05;
    return new Promise(resolve => {
        const ms = Math.max(0, (end - ctx.currentTime) * 1000);
        setTimeout(resolve, ms);
    });
}