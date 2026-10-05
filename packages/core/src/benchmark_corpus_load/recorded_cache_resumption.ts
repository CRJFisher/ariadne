/**
 * What a self-validating cache blob buys, measured rather than argued.
 *
 * The capability is resumption. A load killed partway through leaves behind
 * every file it finished, and the next run picks them up: 160 blobs on disk
 * after `kill -9`, 160 cache hits on the restart, and a call graph identical to
 * an uninterrupted cold load's, component for component. The same corpus and
 * the same kill on the tree immediately before this change left the same 160
 * blobs and reused none of them, because the manifest that described them was
 * written after the loop the kill interrupted.
 *
 * Three costs travel with the record because each one is a number a later
 * change would otherwise re-derive from a guess. A warm cache hits every file
 * it is offered minus the files indexing dropped, at four slice sizes. A full
 * cache that matches nothing costs 2.94% of CPU over a load that writes the
 * same blobs and reads none. And eliding the source path from every reference
 * record takes a blob to 0.590 of its bytes and its `JSON.parse` to 0.838 of
 * its cost.
 *
 * One commitment this task was written against is REFUTED by its own arms and
 * is carried here rather than dropped: the 120-blob sample does NOT fall to
 * 32 MB. It falls to 49.56 from 83.96, and the arithmetic says no elision could
 * have reached 32 — removing the path from the WHOLE blob, definitions and
 * scopes included, floors at 38.21 MB on this tree. The 68.56 MB the target was
 * set against is a smaller index than this tree produces; what reproduces
 * almost exactly is the parse figure, 205.4 ms recorded against 208.1 measured.
 */

interface CpuSpread {
  readonly mean_ms: number;
  readonly min_ms: number;
  readonly max_ms: number;
  readonly spread_percent: number;
  readonly cv_percent: number;
  readonly observations_ms: readonly number[];
}

interface FingerprintDigest {
  readonly count: number;
  readonly hash: string;
}

/**
 * One arm of the kill-and-resume pair. `blobs_on_disk_after_the_kill` is what
 * the interrupted run finished; `cache_hits_on_restart` is what the next run
 * could use. The gap between them is the whole finding.
 */
interface ResumptionArm {
  readonly tree: string;
  readonly blobs_on_disk_after_the_kill: number;
  readonly manifest_on_disk_after_the_kill: boolean;
  readonly temporary_files_after_the_kill: number;
  readonly cache_hits_on_restart: number;
  readonly cache_misses_on_restart: number;
  readonly temporary_files_after_the_restart: number;
  readonly indexed_on_restart: number;
  readonly dropped_on_restart: number;
}

interface WarmCacheRow {
  readonly files_offered: number;
  readonly dropped: number;
  readonly cold_hits: number;
  readonly warm_hits: number;
  readonly warm_misses: number;
}

interface BlobSizeArm {
  readonly label: string;
  readonly bytes: number;
  readonly megabytes: number;
  readonly parse_ms: CpuSpread;
}

export interface RecordedCacheResumption {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly ariadne_commit: string;
  readonly control_commit: string;
  readonly session_id: string;

  readonly kill_and_resume: {
    readonly predicate: string;
    readonly discovered_files: number;
    readonly files: number;
    /**
     * The slice is copied into a temp directory and loaded as a whole project.
     * That is the shape a user's interrupted run takes, and the only shape
     * under which the orphan sweep runs at all.
     */
    readonly corpus_shape: string;
    readonly kill_after_ms: number;
    readonly candidate: ResumptionArm;
    readonly control: ResumptionArm;
    /** Components of the seven that differ between the resumed and cold arms. */
    readonly fingerprint_components_moved: readonly string[];
    readonly fingerprint: Readonly<Record<string, FingerprintDigest>>;
  };

  readonly warm_cache_hits: {
    readonly predicate: string;
    readonly discovered_files: number;
    readonly rows: readonly WarmCacheRow[];
    readonly invariant: string;
  };

  /**
   * Both arms index every file and write every blob. They differ only in
   * whether a blob is on disk to be read, parsed and rejected first, which is
   * what isolates the rejection cost: a control that wrote nothing would charge
   * the rejection with the cost of populating a cache, and measured +25.4%
   * instead of +2.9%.
   */
  readonly rejecting_a_full_cache: {
    readonly predicate: string;
    readonly files: number;
    readonly blobs: number;
    readonly cache_hits: number;
    readonly control: CpuSpread;
    readonly candidate: CpuSpread;
    readonly overhead_percent: number;
    readonly ms_per_rejected_blob: number;
    readonly loadavg_at_end: readonly number[];
  };

  readonly blob_size: {
    readonly predicate: string;
    readonly blobs: number;
    readonly reference_records: number;
    readonly mean_source_path_chars: number;
    readonly control: BlobSizeArm;
    readonly candidate: BlobSizeArm;
    readonly size_ratio: number;
    readonly parse_ratio: number;
    /** Where a blob's bytes are, measured on the control arm. */
    readonly composition: {
      readonly total_mb: number;
      readonly references_mb: number;
      readonly references_share_percent: number;
      readonly path_share_of_references_percent: number;
      readonly rest_mb: number;
      readonly path_share_of_rest_percent: number;
      /**
       * What removing the path from the WHOLE blob would leave — definitions,
       * scopes and map keys included. The floor no elision can beat, and it is
       * above the 32 MB this task was written against.
       */
      readonly whole_blob_elision_floor_mb: number;
    };
    readonly refuted: string;
  };
}

export const RECORDED_CACHE_RESUMPTION: RecordedCacheResumption = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  ariadne_commit: "ded8a2ca+task-381.9",
  control_commit: "ded8a2ca",
  session_id: "task-381.9",

  kill_and_resume: {
    predicate: "folder-ts:src/vs/base",
    discovered_files: 479,
    files: 200,
    corpus_shape:
      "The 200 path-sorted `.ts` files copied into a temp directory, loaded with no `files` or `folders` filter, so both arms run as whole-project loads.",
    kill_after_ms: 8000,
    candidate: {
      tree: "self-describing blobs",
      blobs_on_disk_after_the_kill: 160,
      manifest_on_disk_after_the_kill: false,
      temporary_files_after_the_kill: 0,
      cache_hits_on_restart: 160,
      cache_misses_on_restart: 40,
      temporary_files_after_the_restart: 0,
      indexed_on_restart: 200,
      dropped_on_restart: 0,
    },
    control: {
      tree: "ariadne@ded8a2ca, blobs described by a manifest written after the load loop",
      blobs_on_disk_after_the_kill: 160,
      manifest_on_disk_after_the_kill: false,
      temporary_files_after_the_kill: 0,
      cache_hits_on_restart: 0,
      cache_misses_on_restart: 200,
      temporary_files_after_the_restart: 0,
      indexed_on_restart: 200,
      dropped_on_restart: 0,
    },
    fingerprint_components_moved: [],
    fingerprint: {
      nodes: { count: 5712, hash: "dff4c6207138e42c" },
      call_edges: { count: 9657, hash: "c737959cf06b73b8" },
      unresolved_calls: { count: 8090, hash: "b149571db2449810" },
      raw_entry_points: { count: 1801, hash: "ef82987127ef3680" },
      indirect_reachability_keys: { count: 1186, hash: "eebc4c05427ad5ca" },
      dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
      indirect_reachability_evidence: { count: 1186, hash: "1165762d2171dc09" },
    },
  },

  warm_cache_hits: {
    predicate: "src",
    discovered_files: 8494,
    rows: [
      { files_offered: 50, dropped: 0, cold_hits: 0, warm_hits: 50, warm_misses: 0 },
      { files_offered: 200, dropped: 0, cold_hits: 0, warm_hits: 200, warm_misses: 0 },
      { files_offered: 400, dropped: 0, cold_hits: 0, warm_hits: 400, warm_misses: 0 },
      { files_offered: 800, dropped: 0, cold_hits: 0, warm_hits: 800, warm_misses: 0 },
    ],
    invariant:
      "A warm cache hits every file it is offered minus the files indexing dropped. The dropped set is empty at all four sizes on this tree, so the four rows read as hits equal to files offered.",
  },

  rejecting_a_full_cache: {
    predicate: "src",
    files: 800,
    blobs: 800,
    cache_hits: 0,
    control: {
      mean_ms: 32901.0,
      min_ms: 31375.3,
      max_ms: 36523.1,
      spread_percent: 16.41,
      cv_percent: 5.68,
      observations_ms: [32668.4, 31643.4, 32294.8, 31375.3, 36523.1],
    },
    candidate: {
      mean_ms: 33867.9,
      min_ms: 32998.1,
      max_ms: 35416.2,
      spread_percent: 7.33,
      cv_percent: 2.49,
      observations_ms: [35416.2, 33721.7, 32998.1, 33255.5, 33948.2],
    },
    overhead_percent: 2.94,
    ms_per_rejected_blob: 1.21,
    loadavg_at_end: [6.23, 5.58, 6.51],
  },

  blob_size: {
    predicate: "folder-ts:src/vs/base",
    blobs: 120,
    reference_records: 135397,
    mean_source_path_chars: 106,
    control: {
      label: "the source path kept in every reference record",
      bytes: 88042453,
      megabytes: 83.96,
      parse_ms: {
        mean_ms: 208.1,
        min_ms: 205.6,
        max_ms: 210.6,
        spread_percent: 2.43,
        cv_percent: 0.87,
        observations_ms: [210.6, 205.6, 206.6, 209.6, 207.9],
      },
    },
    candidate: {
      label: "the source path stored once in the blob header",
      bytes: 51966143,
      megabytes: 49.56,
      parse_ms: {
        mean_ms: 174.3,
        min_ms: 171.6,
        max_ms: 180.3,
        spread_percent: 5.07,
        cv_percent: 1.83,
        observations_ms: [173.6, 171.6, 172.6, 180.3, 173.3],
      },
    },
    size_ratio: 1.694,
    parse_ratio: 1.194,
    composition: {
      total_mb: 83.93,
      references_mb: 64.48,
      references_share_percent: 76.8,
      path_share_of_references_percent: 53.4,
      rest_mb: 19.45,
      path_share_of_rest_percent: 58.2,
      whole_blob_elision_floor_mb: 38.21,
    },
    refuted:
      "The `<= 32 MB` target is not reachable on this tree and is refuted rather than met. Removing the path from every reference record takes 83.96 MB to 49.56; removing it from the whole blob, definitions and scopes included, would floor at 38.21. The 68.56 MB the target was set against is a smaller index than this tree produces — what reproduces is the parse figure, 205.4 ms recorded against 208.1 measured, and the parse bound of 175 ms is met at 174.3.",
  },
};
