/**
 * The heap an arm of this size needs, and the headroom a parent gives it.
 *
 * One function, read by the parent that sizes a child and by the child that
 * refuses to start under a cap too small for it. Two copies of one coefficient
 * is a guard that can drift out of agreement with the thing it guards; this is
 * that one coefficient.
 *
 * **File count is a poor predictor of peak memory, and this line is a ceiling
 * rather than an estimate.** Measured peak resident set, over nine corpora:
 * express 141 files / 250 MB, sqlx 459 / 413, mocha 534 / 271, tokio 790 /
 * 465, pandas 1,510 / 2,183, django 3,012 / 1,749, rustc 3,516 / 3,011,
 * angular 6,345 / 4,447 — and microsoft/TypeScript, 19,763 files, **3,623
 * MB**. The largest corpus by file count costs less than angular, which holds
 * a third as many files, because TypeScript's bulk is small conformance
 * fixtures under `tests/cases/`. pandas at 1,510 files costs more than django
 * at 3,012 for the same reason in the other direction. What a load holds
 * tracks how much source the files carry, not how many there are.
 *
 * So the line is fitted as the tightest one that sits above every measured
 * arm, not through them, and it over-provisions by design: 3.1x on
 * TypeScript, 1.05x on pandas, which is the point it binds at. Sizing from
 * bytes of source rather than from a file count would let it be tight instead
 * of merely safe; that is TASK-398, and until it lands a generous ceiling is
 * the honest shape for a guard whose whole job is to refuse the impossible.
 *
 * The failure this permits is recoverable and loud — the arm dies to the OOM
 * killer and the harness reports the signal — where the failure it replaces
 * was silent: the previous fit demanded 28,096 MB for TypeScript, refused it
 * on a 32,768 MB box, and left the corpus unmeasured for eight times the
 * memory it actually needed.
 */
export function required_heap_mb(offered_file_count: number): number {
  return Math.ceil(1500 + 0.5 * offered_file_count);
}

/** What to give a child: its requirement plus headroom. */
export function heap_mb_for(offered_file_count: number): number {
  return Math.max(2048, Math.ceil(required_heap_mb(offered_file_count) * 1.25));
}
