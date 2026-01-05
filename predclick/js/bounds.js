import { CFG } from "./config.js";

export function greenBounds(t) {
    const w = CFG.w0 + (CFG.w1 - CFG.w0) * (t / CFG.T);
    return [-w, +w];
}

function wedgeWidth(t, t_on, t_peak, t_off, w_on, w_peak, w_off) {
    if (t < t_on || t > t_off) return null;
    if (t <= t_peak) {
        const u = (t - t_on) / (Math.max(1e-12, (t_peak - t_on)));
        return w_on + (w_peak - w_on) * u;
    } else {
        const u = (t - t_peak) / (Math.max(1e-12, (t_off - t_peak)));
        return w_peak + (w_off - w_peak) * u;
    }
}

export function grayIntervalsAt(t) {
    const ivs = [];

    // top wedge: [base, base + w(t)]
    {
        const p = CFG.gray.top;
        const w = wedgeWidth(t, p.t_on, p.t_peak, p.t_off, p.w_on, p.w_peak, p.w_off);
        if (w !== null && w > 0) ivs.push([p.base, p.base + w]);
    }

    // bottom wedge: [base - w(t), base]
    {
        const p = CFG.gray.bot;
        const w = wedgeWidth(t, p.t_on, p.t_peak, p.t_off, p.w_on, p.w_peak, p.w_off);
        if (w !== null && w > 0) ivs.push([p.base - w, p.base]);
    }

    // middle rectangle
    {
        const p = CFG.gray.mid;
        if (t >= p.t_on && t <= p.t_off) ivs.push([p.center - p.half_width, p.center + p.half_width]);
    }

    if (ivs.length === 0) return null;

    // merge
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

export function allowed(e, t) {
    const [glo, ghi] = greenBounds(t);
    if (!(glo <= e && e <= ghi)) return false;
    const gray = grayIntervalsAt(t);
    if (gray) {
        for (const [lo, hi] of gray) if (lo <= e && e <= hi) return false;
    }
    return true;
}