// plotting.js
import { CFG } from "./config.js";
import { grayIntervalsAt } from "./bounds.js";

export function initPlotting(canvas) {
  const ctx2d = canvas.getContext("2d");

  function clearCanvas() {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    ctx2d.fillStyle = "rgba(0,0,0,0.10)";
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  }

  function computeYRangeFromTrajectoryAndGray(trial) {
    const ts = trial.traj.ts;
    let ymin = +Infinity,
      ymax = -Infinity;

    // trajectory
    for (let k = 0; k < trial.traj.E.length; k++) {
      const e = trial.traj.E[k];
      ymin = Math.min(ymin, e);
      ymax = Math.max(ymax, e);
    }

    // gray intervals (if any)
    for (let k = 0; k < ts.length; k++) {
      const ivs = grayIntervalsAt(ts[k]);
      if (!ivs) continue;
      for (const [lo, hi] of ivs) {
        ymin = Math.min(ymin, lo);
        ymax = Math.max(ymax, hi);
      }
    }

    if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) {
      ymin = -10;
      ymax = 10;
    }

    ymin = Math.floor(ymin) - 2;
    ymax = Math.ceil(ymax) + 2;
    return [ymin, ymax];
  }

  function computeYRangeFromGrayOnly() {
    const ts = [];
    for (let t = 0; t <= CFG.T + 1e-12; t += CFG.dtPlot) ts.push(t);

    let ymin = +Infinity,
      ymax = -Infinity;
    for (const t of ts) {
      const ivs = grayIntervalsAt(t);
      if (!ivs) continue;
      for (const [lo, hi] of ivs) {
        ymin = Math.min(ymin, lo);
        ymax = Math.max(ymax, hi);
      }
    }

    // if no gray at all (control), pick a sane default
    if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) {
      return [-15, 15];
    }

    ymin = Math.floor(ymin) - 2;
    ymax = Math.ceil(ymax) + 2;
    return [ymin, ymax];
  }

  function plotStateSpaceBase(trial) {
    clearCanvas();
    const W = canvas.width,
      H = canvas.height;
    const padL = 60,
      padR = 20,
      padT = 20,
      padB = 45;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const [ymin, ymax] = computeYRangeFromTrajectoryAndGray(trial);
    const xOfT = (t) => padL + (t / CFG.T) * innerW;
    const yOfE = (e) => padT + (1 - (e - ymin) / (ymax - ymin)) * innerH;

    // gray forbidden regions
    ctx2d.save();
    ctx2d.globalAlpha = 0.28;
    ctx2d.fillStyle = "#6b7280";
    const step = CFG.dtPlot;
    for (let i = 0; i < Math.floor(CFG.T / step); i++) {
      const tL = i * step,
        tR = (i + 1) * step,
        tM = 0.5 * (tL + tR);
      const ivs = grayIntervalsAt(tM);
      if (!ivs) continue;
      const x0 = xOfT(tL),
        x1 = xOfT(tR);
      for (const [lo, hi] of ivs) {
        const y0 = yOfE(hi),
          y1 = yOfE(lo);
        ctx2d.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    ctx2d.restore();

    // axes
    ctx2d.save();
    ctx2d.strokeStyle = "rgba(255,255,255,0.35)";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(padL, padT);
    ctx2d.lineTo(padL, padT + innerH);
    ctx2d.lineTo(padL + innerW, padT + innerH);
    ctx2d.stroke();
    ctx2d.restore();

    // y ticks
    const kLabel = 5;
    ctx2d.save();
    ctx2d.font = "12px ui-sans-serif, system-ui";
    ctx2d.fillStyle = "rgba(255,255,255,0.75)";
    ctx2d.strokeStyle = "rgba(255,255,255,0.18)";
    for (let e = Math.ceil(ymin); e <= Math.floor(ymax); e++) {
      const y = yOfE(e);
      ctx2d.beginPath();
      ctx2d.moveTo(padL - 4, y);
      ctx2d.lineTo(padL, y);
      ctx2d.stroke();
      if (e % kLabel === 0) ctx2d.fillText(String(e), 12, y + 4);
    }
    ctx2d.restore();

    // labels
    ctx2d.save();
    ctx2d.fillStyle = "rgba(255,255,255,0.75)";
    ctx2d.font = "13px ui-sans-serif, system-ui";
    ctx2d.fillText("time (s)", padL + innerW / 2 - 26, H - 14);
    ctx2d.translate(16, padT + innerH / 2 + 40);
    ctx2d.rotate(-Math.PI / 2);
    ctx2d.fillText("evidence (#R - #L)", 0, 0);
    ctx2d.restore();

    // dashed lines: 0 and ±30 like python
    const drawH = (yVal, alpha = 0.25) => {
      ctx2d.save();
      ctx2d.setLineDash([6, 6]);
      ctx2d.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(padL, yOfE(yVal));
      ctx2d.lineTo(padL + innerW, yOfE(yVal));
      ctx2d.stroke();
      ctx2d.restore();
    };
    drawH(0, 0.25);
    drawH(30, 0.18);
    drawH(-30, 0.18);

    return { xOfT, yOfE };
  }

  function plotStateSpaceBaseFixedYRange() {
    clearCanvas();
    const W = canvas.width,
      H = canvas.height;
    const padL = 60,
      padR = 20,
      padT = 20,
      padB = 45;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const [ymin, ymax] = computeYRangeFromGrayOnly();
    const xOfT = (t) => padL + (t / CFG.T) * innerW;
    const yOfE = (e) => padT + (1 - (e - ymin) / (ymax - ymin)) * innerH;

    // gray regions
    ctx2d.save();
    ctx2d.globalAlpha = 0.28;
    ctx2d.fillStyle = "#6b7280";
    const step = CFG.dtPlot;
    for (let i = 0; i < Math.floor(CFG.T / step); i++) {
      const tL = i * step,
        tR = (i + 1) * step,
        tM = 0.5 * (tL + tR);
      const ivs = grayIntervalsAt(tM);
      if (!ivs) continue;
      const x0 = xOfT(tL),
        x1 = xOfT(tR);
      for (const [lo, hi] of ivs) {
        const y0 = yOfE(hi),
          y1 = yOfE(lo);
        ctx2d.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    ctx2d.restore();

    // axes + labels + dashed lines (same as above)
    // (you can keep your existing axes/ticks/labels code, just without green)

    return { xOfT, yOfE };
  }

  function drawTrajectory(trial, frac) {
    const base = plotStateSpaceBase(trial);
    const { xOfT, yOfE } = base;

    const ts = trial.traj.ts;
    const E = trial.traj.E;
    const tMax = CFG.T * frac;

    const color =
      trial.finalE > 0 ? "#ef4444" : trial.finalE < 0 ? "#3b82f6" : "#22c55e";

    ctx2d.save();
    ctx2d.strokeStyle = color;
    ctx2d.globalAlpha = 0.92;
    ctx2d.lineWidth = 3;
    ctx2d.beginPath();

    let started = false;
    for (let k = 0; k < ts.length; k++) {
      const t = ts[k];
      if (t > tMax) break;
      const x = xOfT(t);
      const y = yOfE(E[k]);
      if (!started) {
        ctx2d.moveTo(x, y);
        started = true;
      } else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx2d.restore();
  }

  function drawTrajectoryOnBase(base, trial, alpha = 0.15, lw = 1) {
    const { xOfT, yOfE } = base;
    const ts = trial.traj.ts;
    const E = trial.traj.E;
    const color =
      trial.finalE > 0 ? "#ef4444" : trial.finalE < 0 ? "#3b82f6" : "#22c55e";

    ctx2d.save();
    ctx2d.strokeStyle = color;
    ctx2d.globalAlpha = alpha;
    ctx2d.lineWidth = lw;
    ctx2d.beginPath();
    for (let k = 0; k < ts.length; k++) {
      const x = xOfT(ts[k]);
      const y = yOfE(E[k]);
      if (k === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx2d.restore();
  }

  function drawBlankPlot() {
    clearCanvas();
  }

  return {
    clearCanvas,
    drawBlankPlot,
    plotStateSpaceBaseFixedYRange,
    drawTrajectory,
    drawTrajectoryOnBase,
  };
}
