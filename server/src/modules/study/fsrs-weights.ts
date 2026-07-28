// Default FSRS-4.5 weights (w[0..18]) — the official defaults from the open-spaced-repetition/fsrs4anki
// project, trained on a large dataset of real Anki reviews. For a personal single-user tool, fully
// retraining the weights on your own history isn't worthwhile (too little data) — the defaults give
// a well-grounded out-of-the-box starting point, without needing a dataset or training.
// Kept in a separate file to colocate with the source comment and avoid cluttering fsrs.ts.
// A fixed-length tuple type (19 elements), not `number[]` — with noUncheckedIndexedAccess a plain
// array would give `number | undefined` at every index; a tuple with an exact element count lets
// TS know all 19 positions are always defined.
export type FsrsWeights = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export function getFsrsWeights(): FsrsWeights {
  return FSRS_DEFAULT_WEIGHTS;
}

const FSRS_DEFAULT_WEIGHTS: FsrsWeights = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466,
  0.5034, 0.6567,
];
