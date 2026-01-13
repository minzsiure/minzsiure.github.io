// config.js (RODENT)
const SHIFT = {
  A: 0.0,
  B: -0.1, // matches python shift_dic
};

// pick condition
const SHIFT_KEY = "A";
const s = SHIFT[SHIFT_KEY] ?? 0.0;

//
// ----- Rodent core timing / rates -----
//
const T = 1.0;
const dt = 0.01;

// lam list + prb list (uniform in python)
const lam = [
  [39, 1],
  [31, 9],
  [37, 3],
  [26, 14],
];
const prb = [0.25, 0.25, 0.25, 0.25];

//
// ----- Rodent block geometry (derived exactly like python) -----
//
const diamond_evi_onset = 6.5;
const diamond_t_on = 0.25;
const diamond_t_peak = 0.45;
const diamond_t_off = 0.65;

// R_high, R_low = diamond_evi_onset + 4.5, diamond_evi_onset + 2
const R_high = diamond_evi_onset + 4.5; // 11.0
const R_low = diamond_evi_onset + 2.0; // 8.5
const L_high = -R_high; // -11.0
const L_low = -R_low; // -8.5

const rectangle_onset = diamond_t_off - 0.1; // 0.55
const tilt_up_onset_time = rectangle_onset - 0.1; // 0.45
const tilt_up_offset_time = tilt_up_onset_time + 0.06; // 0.51

const tile_up_onset_evidence = R_high + 1.0; // 12.0
const tile_up_offset_evidence = R_high + 2.0; // 13.0

export const CFG = {
  // --- condition switch ---
  // "control": no gray blocks (allowed everywhere)
  // "test": gray blocks enabled
  condition: "test", // <-- flip to "control" manually

  mode: "rodent",
  shiftKey: SHIFT_KEY,
  shift: s,

  // timeline
  T,
  dtPlot: dt,
  dtCheck: dt,

  // sampling
  lam, // array of [lamL, lamR]
  prb, // probabilities (same length as lam)
  maxAttempts: 5000,
  avoidTie: true,
  maxTriesPerBin: 1000, // matches python max_tries_per_bin

  // stereo first click + IPI
  firstClickStereo: true,
  minIpi: null, // e.g. 0.03 for 30ms; null disables

  // audio (your JS defaults; python used 0.1ms and different freq/amp for wav writing)
  clickMs: 2.0,
  freqHz: 2000.0,
  amp: 0.35,

  // green bounds (python: w0=w1=40)
  //   w0: 40,
  //   w1: 40,

  // for downstream categorization if you want
  R_high,
  R_low,
  L_high,
  L_low,

  // gray blocks (constructed with shift `s`)
  grayBlocks: [
    // top wedge: base=0, w_peak=diamond_evi_onset
    {
      kind: "wedgeTop",
      t_on: diamond_t_on + s,
      t_peak: diamond_t_peak + s,
      t_off: diamond_t_off + s,
      base: 0.0,
      w_on: 0.0,
      w_peak: diamond_evi_onset,
      w_off: 0.0,
    },

    // bottom wedge: base=0, w_peak=diamond_evi_onset
    {
      kind: "wedgeBot",
      t_on: diamond_t_on + s,
      t_peak: diamond_t_peak + s,
      t_off: diamond_t_off + s,
      base: 0.0,
      w_on: 0.0,
      w_peak: diamond_evi_onset,
      w_off: 0.0,
    },

    // mid rectangle: t_on = diamond_t_peak, to T, [-0.5, +0.5]
    {
      kind: "rect",
      t_on: diamond_t_peak + s,
      t_off: T,
      center: 0.0,
      half_width: 0.5,
    },

    // upper/lower rectangles: from rectangle_onset to T, [R_low,R_high] and [L_high,L_low]
    // NOTE: your JS rect format is center/half_width so convert:
    // center = (hi+lo)/2, half_width = (hi-lo)/2
    {
      kind: "rect",
      t_on: rectangle_onset + s,
      t_off: T,
      center: 0.5 * (R_high + R_low),
      half_width: 0.5 * (R_high - R_low),
    },
    {
      kind: "rect",
      t_on: rectangle_onset + s,
      t_off: T,
      center: 0.5 * (L_high + L_low),
      half_width: 0.5 * (L_low - L_high),
    },

    // tilted rectangle (upper) from vertices exactly like python helper
    {
      kind: "poly",
      vertices: [
        [tilt_up_onset_time + s, tile_up_onset_evidence],
        [tilt_up_offset_time + s, tile_up_offset_evidence],
        [rectangle_onset + 0.05 + s, R_high],
        [rectangle_onset + s, R_low],
      ],
    },

    // tilted rectangle (lower) mirrored
    {
      kind: "poly",
      vertices: [
        [tilt_up_onset_time + s, -tile_up_onset_evidence],
        [tilt_up_offset_time + s, -tile_up_offset_evidence],
        [rectangle_onset + 0.05 + s, L_high],
        [rectangle_onset + s, L_low],
      ],
    },
  ],
};
