/**
 * What an arm's peak memory was measured against: the bytes of source it held.
 *
 * `required_heap_mb` is fitted to these rows. Each is one arm that completed,
 * the byte size of the file set it was offered (summed from `fs.stat` over the
 * predicate's discovery walk, the same sum the parent and the child both take),
 * and the peak resident set it reached under the heap cap it was given then.
 *
 * Peak RSS follows bytes far more closely than files: the correlation is 0.96
 * over bytes and 0.70 over file count across these eleven arms. It does not
 * follow bytes exactly. Peak RSS per MiB of source is 55 for vscode's `src/`,
 * 60 for rust, 90 to 98 for django, TypeScript and pandas, and 121 for angular,
 * and the small corpora run 87 to 479 because a fixed cost of a few hundred
 * megabytes dominates them. A line through bytes cannot be tight to all of
 * those, so the fit is a ceiling that binds at angular and is 1.3x to 2.1x
 * above every other arm; fitted on file count the same arms spanned 0.92x to
 * 6.5x, and the repository root of vscode sat under its own guard.
 *
 * The peaks were taken under caps sized for the previous fit, which were
 * larger than the new ones for every row but vscode's `src/`. A collector given
 * more room runs later and holds more, so these are the conservative side of
 * what the new caps will reach.
 */

export interface RecordedHeapRequirementRow {
  /** Stable corpus name, e.g. "django/django"; vscode rows carry their predicate. */
  readonly corpus: string;
  readonly predicate: string;
  /** Files the predicate's discovery walk offered. */
  readonly offered_files: number;
  /** Bytes of source in those files. */
  readonly offered_bytes: number;
  /** The larger of the arm's processes, under `previous_heap_cap_mb`. */
  readonly peak_rss_mb: number;
  readonly previous_heap_cap_mb: number;
}

export interface RecordedHeapRequirement {
  readonly machine: string;
  readonly rows: readonly RecordedHeapRequirementRow[];
}

export const RECORDED_HEAP_REQUIREMENT: RecordedHeapRequirement = {
  machine: "Darwin 24.6.0 x64",
  rows: [
    {
      corpus: "expressjs/express",
      predicate: "repository-root",
      offered_files: 141,
      offered_bytes: 548319,
      peak_rss_mb: 250.3,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "launchbadge/sqlx",
      predicate: "repository-root",
      offered_files: 459,
      offered_bytes: 2638136,
      peak_rss_mb: 412.6,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "mochajs/mocha",
      predicate: "repository-root",
      offered_files: 534,
      offered_bytes: 1409926,
      peak_rss_mb: 270.8,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "tokio-rs/tokio",
      predicate: "repository-root",
      offered_files: 790,
      offered_bytes: 5612800,
      peak_rss_mb: 465.4,
      previous_heap_cap_mb: 2096,
    },
    {
      corpus: "pandas-dev/pandas",
      predicate: "repository-root",
      offered_files: 1510,
      offered_bytes: 23305220,
      peak_rss_mb: 2183.2,
      previous_heap_cap_mb: 3191,
    },
    {
      corpus: "django/django",
      predicate: "repository-root-excluding:js_tests,scripts,docs",
      offered_files: 3012,
      offered_bytes: 20454925,
      peak_rss_mb: 1749.3,
      previous_heap_cap_mb: 5820,
    },
    {
      corpus: "rust-lang/rust",
      predicate:
        "repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests",
      offered_files: 3516,
      offered_bytes: 52846844,
      peak_rss_mb: 3010.8,
      previous_heap_cap_mb: 6702,
    },
    {
      corpus: "angular/angular",
      predicate: "repository-root",
      offered_files: 6345,
      offered_bytes: 38464706,
      peak_rss_mb: 4447.1,
      previous_heap_cap_mb: 11652,
    },
    {
      corpus: "microsoft/TypeScript",
      predicate: "repository-root-excluding:baselines",
      offered_files: 19783,
      offered_bytes: 40414867,
      peak_rss_mb: 3623.2,
      previous_heap_cap_mb: 14288,
    },
    {
      corpus: "microsoft/vscode",
      predicate: "src",
      offered_files: 8494,
      offered_bytes: 109947285,
      peak_rss_mb: 5803.45,
      previous_heap_cap_mb: 6192,
    },
    {
      corpus: "microsoft/vscode",
      predicate: "repository-root",
      offered_files: 12654,
      offered_bytes: 155923667,
      peak_rss_mb: 8540.05,
      previous_heap_cap_mb: 22693,
    },
  ],
};
