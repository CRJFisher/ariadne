/**
 * The heap an arm holding this much source needs, and the headroom a parent
 * gives it.
 *
 * One function, read by the parent that sizes a child and by the child that
 * refuses to start under a cap too small for it. Two copies of one coefficient
 * is a guard that can drift out of agreement with the thing it guards; this is
 * that one coefficient.
 *
 * **The quantity is the bytes of source the arm will hold, not how many files
 * there are.** Peak resident set tracks how much source a load holds, and file
 * count is a proxy for that only when files are of similar size. Across the
 * ten evidence corpora they are not: microsoft/TypeScript's 19,763 files peak
 * at 3,623 MB, less than angular's 6,345 at 4,447 MB, because TypeScript's bulk
 * is small conformance fixtures. Fitted on file count the guard was wrong by
 * 3.1x on TypeScript and 6.5x on mocha, and it sat below the measured peak of
 * vscode's repository root; fitted on bytes it is wrong by no more than 2.1x
 * anywhere and sits above all eleven measured arms. The correlation with peak
 * RSS rises from 0.70 to 0.96. `RECORDED_HEAP_REQUIREMENT` holds the figures.
 *
 * **Bytes explain peak memory better, not completely, so this line is a
 * ceiling and not an estimate.** Peak RSS per MiB of source runs from 55
 * (vscode's `src/`) to 121 (angular) over the corpora large enough for the
 * fixed cost not to dominate, and no line through bytes can be both safe and
 * tight over that spread. It is fitted as the tightest line that sits 2%
 * above every measured arm, and it binds at angular and over-provisions
 * everywhere else: 1.3x on TypeScript, 2.1x on vscode's `src/`. The failure it
 * permits is recoverable and loud — the arm dies to the OOM killer and the
 * harness reports the signal — where the failure it replaced was silent.
 */

const BYTES_PER_MIB = 1024 * 1024;

export function required_heap_mb(offered_bytes: number): number {
  return Math.ceil(320 + 115 * (offered_bytes / BYTES_PER_MIB));
}

/** What to give a child: its requirement plus headroom. */
export function heap_mb_for(offered_bytes: number): number {
  return Math.max(2048, Math.ceil(required_heap_mb(offered_bytes) * 1.25));
}

/** Whether a process whose heap ceiling is `heap_cap_mb` may start an arm of this size. */
export function heap_holds(offered_bytes: number, heap_cap_mb: number): boolean {
  return heap_cap_mb >= required_heap_mb(offered_bytes);
}
