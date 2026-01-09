// config.js
const SHIFT = {
  A: 0.0,
  B: -0.3,
};

// pick which condition you want
const SHIFT_KEY = "B";
const s = SHIFT[SHIFT_KEY] ?? 0.0;

export const CFG = {
  shiftKey: SHIFT_KEY,
  T: 2.0,
  lamPair: [25, 15],
  dtPlot: 0.01,
  dtCheck: 0.01,
  maxAttempts: 5000,
  avoidTie: true,
  maxTriesPerBin: 200,

  // audio
  clickMs: 2.0,
  freqHz: 2000.0,
  amp: 0.35,

  // green bounds
  w0: 1,
  w1: 15,

  // gray blocks (constructed using the shift `s`)
  grayBlocks: [
    // wedges
    {
      kind: "wedgeTop",
      t_on: 1.0 + s,
      t_peak: 1.3 + s,
      t_off: 1.6 + s,
      base: 0.0,
      w_on: 0.0,
      w_peak: 5.0,
      w_off: 0.0,
    },
    {
      kind: "wedgeBot",
      t_on: 1.0 + s,
      t_peak: 1.3 + s,
      t_off: 1.6 + s,
      base: 0.0,
      w_on: 0.0,
      w_peak: 5.0,
      w_off: 0.0,
    },

    // mid rectangle
    { kind: "rect", t_on: 1.1 + s, t_off: 2.0, center: 0.0, half_width: 0.5 },

    // upper/lower rectangles
    { kind: "rect", t_on: 1.6 + s, t_off: 2.0, center: 5.0, half_width: 1.5 },
    { kind: "rect", t_on: 1.6 + s, t_off: 2.0, center: -5.0, half_width: 1.5 },

    // tilted rectangles as polygons (same vertex ordering as your Python helper)
    {
      kind: "poly",
      vertices: [
        [1.4 + s, 7.0],
        [1.6 + s, 7.0],
        [1.8 + s, 3.5],
        [1.6 + s, 3.5],
      ],
    },
    {
      kind: "poly",
      vertices: [
        [1.4 + s, -7.0],
        [1.6 + s, -7.0],
        [1.8 + s, -3.5],
        [1.6 + s, -3.5],
      ],
    },
  ],
};
