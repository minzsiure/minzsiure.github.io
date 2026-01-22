// config.js (RODENT)
const SHIFT = {
  A: 0.0,
  B: -0.1, // matches python shift_dic
};

// pick shift
const SHIFT_KEY = "A";
const s = SHIFT[SHIFT_KEY] ?? 0.0;

//
// ----- Rodent core timing / rates -----
//
const T = 1.0;
const dt = 0.01;

//
// ===== rate schedules =====
//
// TEST schedule
const LAM_TEST = [
  [39, 1],
  [37, 3],
  [31, 9],
  [26, 14],
  [20, 20],
];
// const PRB_TEST = [0.25, 0.25, 0.25, 0.25];
const PRB_TEST = [0.175, 0.175, 0.175, 0.175, 0.3];

// CONTROL schedule
const LAM_CONTROL = [
  [39, 1],
  [37, 3],
  [31, 9],
  [26, 14],
  [20, 20],
];
const PRB_CONTROL = [0.1, 0.1, 0.2, 0.2, 0.4];

//
// ----- Rodent block geometry (derived exactly like python) -----
//
const diamond_evi_onset = 3.5; // 6.5;
const diamond_t_on = 0.25;
const diamond_t_peak = 0.45;
const diamond_t_off = 0.65;

// R_high, R_low = diamond_evi_onset + 4.5, diamond_evi_onset + 2
const R_high = diamond_evi_onset + 4.5; // 11.0
const R_low = diamond_evi_onset + 2.0; // 8.5
const L_high = -R_high; // -11.0
const L_low = -R_low; // -8.5

const rectangle_onset = diamond_t_off - 0.1; // 0.55
const tile_up_onset_time = rectangle_onset - 0.1; // 0.45
const tile_up_offset_time = tile_up_onset_time + 0.06; // 0.51

const tile_up_onset_evidence = R_high + 1.0; // 12.0
const tile_up_offset_evidence = R_high + 2.0; // 13.0

//
// ----- Default/free-play condition -----
// This is ONLY the default when you call sampleTrial() with no args.
// Sessions should call sampleTrial("control") / sampleTrial("test") explicitly.
//
const DEFAULT_CONDITION = "test"; // or "control"

export const CFG = {
  // default condition for free-play
  condition: DEFAULT_CONDITION,

  mode: "rodent",
  shiftKey: SHIFT_KEY,
  shift: s,

  // timeline
  T,
  dtPlot: dt,
  dtCheck: dt,

  // -------------------------
  // schedules (BOTH, not baked)
  // -------------------------
  schedules: {
    test: {
      lam: LAM_TEST, // array of [lamA, lamB]
      prb: PRB_TEST, // probabilities, same length
    },
    control: {
      lam: LAM_CONTROL,
      prb: PRB_CONTROL,
    },
  },

  // sampling
  maxAttempts: 5000,
  avoidTie: true,
  maxTriesPerBin: 1000,

  // stereo first click + IPI
  firstClickStereo: true,
  minIpi: null, // e.g. 0.03 for 30ms; null disables

  // audio
  clickMs: 2.0,
  freqHz: 2000.0,
  amp: 0.35,

  // for downstream categorization if you want
  R_high,
  R_low,
  L_high,
  L_low,

  // gray blocks (only used when condition === "test")
  grayBlocks: [
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
    {
      kind: "rect",
      t_on: diamond_t_peak + s,
      t_off: T,
      center: 0.0,
      half_width: 0.5,
    },
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
    {
      kind: "poly",
      vertices: [
        [tile_up_onset_time + s, tile_up_onset_evidence],
        [tile_up_offset_time + s, tile_up_offset_evidence],
        [rectangle_onset + 0.05 + s, R_high],
        [rectangle_onset + s, R_low],
      ],
    },
    {
      kind: "poly",
      vertices: [
        [tile_up_onset_time + s, -tile_up_onset_evidence],
        [tile_up_offset_time + s, -tile_up_offset_evidence],
        [rectangle_onset + 0.05 + s, L_high],
        [rectangle_onset + s, L_low],
      ],
    },
  ],

  switchLamAfterDiamond: true,
  switchTime: tile_up_offset_time,
  regionEvidenceBoundary: tile_up_offset_evidence,
  pHighRegionLamSwitch: 0.2,
  pLowRegionLamSwitch: 1.0,
  lamHiAfterSwitch: 26, // (lam_hi, lam_lo) in your Python
  lamLoAfterSwitch: 14,
};
