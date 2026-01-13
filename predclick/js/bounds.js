// bounds.js
import { CFG } from "./config.js";

function wedgeWidth(t, t_on, t_peak, t_off, w_on, w_peak, w_off) {
  if (t < t_on || t > t_off) return null;
  if (t <= t_peak) {
    const u = (t - t_on) / Math.max(1e-12, t_peak - t_on);
    return w_on + (w_peak - w_on) * u;
  } else {
    const u = (t - t_peak) / Math.max(1e-12, t_off - t_peak);
    return w_peak + (w_off - w_peak) * u;
  }
}

function rectIntervalAt(t, p) {
  if (t >= p.t_on && t <= p.t_off) {
    return [p.center - p.half_width, p.center + p.half_width];
  }
  return null;
}

/**
 * Polygon vertical slice: return [ymin, ymax] of intersection with x=t.
 * vertices: [[x1,y1],[x2,y2],...], in order around polygon.
 */
function polygonIntervalAt(t, vertices) {
  const V = vertices;
  const eps = 1e-12;

  let xMin = Infinity,
    xMax = -Infinity;
  for (const [x] of V) {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
  }
  if (t < xMin - 1e-9 || t > xMax + 1e-9) return null;

  const yHits = [];
  const N = V.length;

  for (let i = 0; i < N; i++) {
    const [x1, y1] = V[i];
    const [x2, y2] = V[(i + 1) % N];

    // vertical edge
    if (Math.abs(x2 - x1) < eps) {
      if (Math.abs(t - x1) < 1e-9) {
        yHits.push(y1, y2);
      }
      continue;
    }

    // segment crosses x=t?
    if ((t - x1) * (t - x2) <= 1e-9) {
      const u = (t - x1) / (x2 - x1);
      if (u >= -1e-9 && u <= 1 + 1e-9) {
        yHits.push(y1 + u * (y2 - y1));
      }
    }
  }

  if (yHits.length < 2) return null;

  let lo = Infinity,
    hi = -Infinity;
  for (const y of yHits) {
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return [lo, hi];
}

function blockIntervalsAt(t, condition) {
  if (condition !== "test") return null;
  const ivs = [];
  const blocks = CFG.grayBlocks ?? [];

  for (const b of blocks) {
    if (b.kind === "wedgeTop") {
      const w = wedgeWidth(
        t,
        b.t_on,
        b.t_peak,
        b.t_off,
        b.w_on ?? 0,
        b.w_peak,
        b.w_off ?? 0
      );
      if (w !== null && w > 0) ivs.push([b.base, b.base + w]);
    } else if (b.kind === "wedgeBot") {
      const w = wedgeWidth(
        t,
        b.t_on,
        b.t_peak,
        b.t_off,
        b.w_on ?? 0,
        b.w_peak,
        b.w_off ?? 0
      );
      if (w !== null && w > 0) ivs.push([b.base - w, b.base]);
    } else if (b.kind === "rect") {
      const iv = rectIntervalAt(t, b);
      if (iv) ivs.push(iv);
    } else if (b.kind === "poly") {
      const iv = polygonIntervalAt(t, b.vertices);
      if (iv) ivs.push(iv);
    } else {
      // unknown kind: ignore
    }
  }

  if (ivs.length === 0) return null;

  // merge like you already do
  ivs.sort((a, b) => a[0] - b[0]);
  const merged = [ivs[0].slice()];
  for (let i = 1; i < ivs.length; i++) {
    const [lo, hi] = ivs[i];
    const last = merged[merged.length - 1];
    if (lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  return merged;
}

export function grayIntervalsAt(t, condition = CFG.condition) {
  return blockIntervalsAt(t, condition);
}

export function allowed(e, t, condition = CFG.condition) {
  // control: no constraints at all
  if (condition !== "test") return true;

  const gray = grayIntervalsAt(t, condition);
  if (gray) {
    for (const [lo, hi] of gray) {
      if (lo <= e && e <= hi) return false;
    }
  }
  return true;
}
