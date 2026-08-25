/**
 * This epic's first guard baseline: the measurement that established the
 * entry-point diagnostics payload as a function of the corpus rather than of
 * the order the loader walked it.
 *
 * Six values taken together over one 200-file slice of microsoft/vscode:
 * the raw entry points, the reported (enriched) entry points, the node set,
 * the edge set, and the diagnostics payload hashed twice — as emitted, and
 * deep-sorted-canonical. Forward, reversed and seeded-shuffle ingest of the
 * same slice each produced the same six values, and they match the unpatched
 * tree's forward-order run exactly, so the repair preserved the pre-change
 * forward-order payload while making every order produce it.
 *
 * The two payload hashes earn their place by disagreeing differently. Before
 * the repair, the three orders gave three diag hashes; with the file
 * iteration sorted but the per-name call-site lists still unsorted, they
 * still gave three — and the canonical hash differed too, which is a
 * membership difference, not an ordering one. That is what exposed the
 * 50-item evidence cap as the real cause: a cap fed in walk order decides
 * WHICH evidence survives, and sorting each name's list by (file, line,
 * column) before the cap is what closed it.
 *
 * The hashes are kept verbatim rather than remapped onto this module's
 * digest, for the same reason `RECORDED_ORDER_SENSITIVITY` keeps its own:
 * what makes the record worth anything is that it is what was actually
 * observed. They were produced by the investigation's probe — SHA-256 over
 * its own JSON serialization of each dumped set, first 16 hex — against a
 * tree that predates this module, so they are a record of one run and never
 * a value to compare a current `DiagnosticsFingerprint` with. The live,
 * recomputable descendant of this baseline is the committed expectation in
 * `diagnostics_fingerprint.corpus.test.ts`, which asserts the same
 * three-orders-one-payload property on every test run.
 */

interface RecordedComponentValue {
  readonly count: number;
  readonly hash: string;
}

interface RecordedPayloadHashes {
  /** Hash of the payload as emitted. */
  readonly diag: string;
  /** Hash of the deep-sorted payload; equal diag implies equal canonical. */
  readonly canonical: string;
}

export interface RecordedDiagnosticsBaseline {
  readonly corpus: string;
  readonly corpus_commit: string;
  /**
   * How the 200-file slice was derived from the corpus — recorded in full
   * because the probe's slice predates `nested_slice`'s path-sorted prefixes
   * and can only be rebuilt from this description.
   */
  readonly predicate: string;
  readonly file_count: number;
  readonly indexed: number;
  readonly dropped: number;
  readonly orders_compared: readonly string[];
  /**
   * The probe's shuffle seed did not survive: its raw dumps lived in a
   * scratchpad that was deleted after the epic was filed. Its slice
   * stratification seed (mulberry32, seed 1) did, and is part of
   * `predicate`. Recorded as prose rather than a number so the loss is
   * carried instead of papered over.
   */
  readonly shuffle_seed: string;
  /** The tree measured: the commit plus the change TASK-381.2 lands. */
  readonly ariadne_commit: string;
  readonly hash_algorithm: string;
  readonly recorded: {
    readonly raw_entry_points: RecordedComponentValue;
    readonly reported_entry_points: RecordedComponentValue;
    readonly nodes: RecordedComponentValue;
    readonly edges: RecordedComponentValue;
    readonly diagnostics_payload: RecordedPayloadHashes;
  };
  /**
   * The same probe on the same slice BEFORE the repair, per order — the
   * demonstration that the three-orders-one-payload silence above can fail.
   * With both root causes present the three orders gave three diag hashes;
   * with only the file iteration sorted they still gave three, and the
   * canonical hash moved too, naming the cap rather than the iteration as
   * the remaining cause.
   */
  readonly diag_hashes_before_repair: {
    readonly both_causes_present: readonly string[];
    readonly file_iteration_sorted_only: readonly string[];
  };
  readonly note: string;
}

export const RECORDED_DIAGNOSTICS_BASELINE: RecordedDiagnosticsBaseline = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate:
    "first 200 files of the investigation probe's stratified ordering of Ariadne's walk over src/ " +
    "(files bucketed into 10 byte-size quantiles, each bucket shuffled with mulberry32 seed 1, " +
    "buckets drained round-robin; .d.ts excluded)",
  file_count: 200,
  indexed: 180,
  dropped: 20,
  orders_compared: ["forward", "reversed", "seeded-shuffle"],
  shuffle_seed:
    "unrecovered — the probe's raw dumps were deleted with its scratchpad; the slice's " +
    "stratification seed (mulberry32, 1) survives in the predicate",
  ariadne_commit:
    "12458246 plus the diagnostics-determinism change TASK-381.2 lands; the unpatched " +
    "12458246 produced the same six values on forward ingest",
  hash_algorithm:
    "SHA-256 over the probe's own JSON serialization of each sorted, de-duplicated set, " +
    "first 16 hex — not this module's length-prefixed digest, so never comparable with a " +
    "current fingerprint",
  recorded: {
    raw_entry_points: { count: 849, hash: "0792ca2c771c7fdb" },
    reported_entry_points: { count: 849, hash: "91c1c926a415829c" },
    nodes: { count: 4301, hash: "086675e48bb79174" },
    edges: { count: 12639, hash: "5cc733b99be51768" },
    diagnostics_payload: {
      diag: "1b02e8f53c9e6b6c",
      canonical: "4d88be1462914be3",
    },
  },
  diag_hashes_before_repair: {
    both_causes_present: ["e400117d", "4f101d0c", "83090f60"],
    file_iteration_sorted_only: ["d7561cac", "c3ea5e17", "8ac5650e"],
  },
  note:
    "The slice's 180 indexed and 20 dropped files were identical in every order and arm, so the " +
    "file set was never a confound. Entry-point membership was never at risk — detect_entry_points " +
    "is a pure set difference — which is why the six values include the payload hashes at all: the " +
    "evidence lists were the only part of the reported product that moved with the walk.",
};
