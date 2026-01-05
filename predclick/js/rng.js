export function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    }
}
export const rng = mulberry32((Date.now() & 0xffffffff) >>> 0);

export function poissonKnuth(lambda) {
    // Knuth algorithm; fast when lambda is small (here lam*dt ~ 0.1–0.3)
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;
    do {
        k++;
        p *= Math.max(1e-12, rng());
    } while (p > L);
    return k - 1;
}