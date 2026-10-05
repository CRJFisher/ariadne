/**
 * The precision a measured number is recorded at.
 *
 * Rounding happens once, where the row is built, so that every consumer of a
 * row reads the same value. A figure re-rounded downstream would let two
 * reports of one arm disagree in their last digit, and a spread quoted from
 * one of them would not reproduce from the other.
 *
 * Tenths for milliseconds and megabytes; hundredths for ratios and
 * percentages, where a tenth is coarse enough to hide the difference between
 * two speedups that are genuinely different.
 */

export function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round_to_hundredth(value: number): number {
  return Math.round(value * 100) / 100;
}
