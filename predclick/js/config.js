export const CFG = {
    T: 2.0,
    lamPair: [25, 15],
    dtPlot: 0.01,
    dtCheck: 0.01,
    maxAttempts: 5000,
    avoidTie: true,

    // audio click
    clickMs: 2.0,
    freqHz: 2000.0,
    amp: 0.35,

    // green bounds
    w0: 1,
    w1: 15,

    gray: {
        top: { t_on: 1.0, t_peak: 1.3, t_off: 1.6, base: 3.5, w_on: 0.0, w_peak: 4.0, w_off: 0.0 },
        bot: { t_on: 1.0, t_peak: 1.3, t_off: 1.6, base: -3.5, w_on: 0.0, w_peak: 4.0, w_off: 0.0 },
        mid: { t_on: 1.0, t_off: 2.0, half_width: 0.5, center: 0.0 }
    }
};