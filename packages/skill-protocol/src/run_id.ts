/**
 * Run-id grammar — the shared identifier across the `triage` → `plan` seam.
 *
 * A run-id is `<prefix>-<timestamp>` where `<prefix>` is the 7-char short
 * commit hash of the target repo's HEAD (lowercase hex) or the literal
 * `nogit` for non-git projects, and `<timestamp>` is an ISO-8601 instant with
 * its time-component colons replaced by hyphens so the id is filesystem-safe
 * (it names a directory and a `triage_results/<run-id>.json` file).
 *
 * Example: `deadbee-2026-04-28T13-42-07.812Z`.
 *
 * `RunId` is branded so a validated id cannot be confused with an arbitrary
 * string; the only ways to obtain one are `build_run_id` (construction) and
 * `parse_run_id`/`is_run_id` (validation).
 */

// eslint-disable-next-line @typescript-eslint/naming-convention
export type RunId = string & { __brand: "RunId" };

/**
 * Matches `<7-hex|nogit>-<iso-ts-with-hyphenated-time>`. The timestamp is the
 * shape of `new Date().toISOString()` (`YYYY-MM-DDTHH:MM:SS.mmmZ`) after the
 * time colons are replaced with hyphens.
 */
export const RUN_ID_REGEX =
  /^(?:[0-9a-f]{7}|nogit)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;

/**
 * Construct a run-id for the current instant. `short_commit` is the 7-char
 * HEAD hash of the target repo, or `null` for a non-git project (becomes the
 * `nogit` prefix).
 */
export function build_run_id(short_commit: string | null): RunId {
  const ts = new Date().toISOString().replace(/:/g, "-");
  const prefix = short_commit ?? "nogit";
  return `${prefix}-${ts}` as RunId;
}

/** Type guard: true when `value` is a well-formed run-id. Never throws. */
export function is_run_id(value: string): value is RunId {
  return RUN_ID_REGEX.test(value);
}

/**
 * Validate `value` as a run-id, returning the branded form. Throws on any
 * malformed input — use at the boundaries that receive a single, specific
 * run-id (a `--run <path>` argument, a finalize target), not for bulk
 * filesystem discovery (filter with `is_run_id` there).
 */
export function parse_run_id(value: string): RunId {
  if (!RUN_ID_REGEX.test(value)) {
    throw new Error(
      `Invalid run-id ${JSON.stringify(value)}: expected <7-hex-commit|nogit>-<iso-timestamp-with-hyphenated-time> (e.g. "deadbee-2026-04-28T13-42-07.812Z").`,
    );
  }
  return value as RunId;
}
