/**
 * The two-hash fingerprint of the entry-point diagnostics payload.
 *
 * Which evidence a classifier sees about an entry point is part of the
 * reported product, and a defect in it is invisible to the call-graph
 * fingerprint: entry-point membership can hold perfectly still while the
 * evidence lists under each entry move with ingest order. These two digests
 * pin the payload itself.
 *
 * Two hashes because their disagreement is a diagnosis. `diag_hash` digests
 * each enriched entry exactly as extraction emitted it, so a difference in
 * membership OR in the order of an entry's evidence lists moves it.
 * `canonical_hash` digests a deep-sorted form — object keys sorted, arrays
 * sorted by their members' canonical JSON — so only a membership difference
 * can move it. Two runs whose diag hashes differ while their canonical hashes
 * agree differ only in list ordering; when the canonical hashes differ too,
 * the runs saw different evidence. That discrimination is what found the real
 * cause of the diagnostics order-dependence: with the file iteration sorted,
 * the canonical hash still moved between ingest orders, and a membership
 * difference under a per-entry cap means the cap was fed in walk order.
 *
 * The payload array's own order never enters either hash — the entries are
 * digested as sorted members, because that order is a presentation ranking by
 * tree size, not evidence. Every string is made relative to the corpus root
 * BEFORE canonicalization, for the same reason the call-graph fingerprint
 * relativizes, plus one of its own: canonical array order is decided by
 * member content, so sorting members that still embedded absolute paths would
 * make even the canonical hash a function of where the corpus sits on disk.
 */

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import * as path from "path";
import { digest_members } from "./streaming_digest";

/**
 * The contract version of the two hashes. Bump when the digest algorithm or
 * width changes, when the member grammar changes, or when
 * `extract_entry_point_diagnostics` deliberately changes what the payload
 * holds. A committed baseline carries it, and a comparison across two
 * versions is refused rather than reported as a regression.
 */
export const DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION = 1;

export interface DiagnosticsFingerprint {
  readonly schema_version: number;
  readonly entry_point_count: number;
  /** Digest of the payload as emitted: membership and evidence-list order. */
  readonly diag_hash: string;
  /** Digest of the deep-sorted payload: membership alone. */
  readonly canonical_hash: string;
}

function normalize_root(corpus_root: string): string {
  if (!path.isAbsolute(corpus_root)) {
    throw new Error(
      `The corpus root must be absolute, got "${corpus_root}". A relative root strips the wrong prefix and leaves machine-specific paths in every member.`,
    );
  }
  const forward = path.resolve(corpus_root).replace(/\\/g, "/");
  return forward.endsWith("/") ? forward : `${forward}/`;
}

/**
 * Strip the corpus root from every string in the payload, wherever it occurs
 * inside the string: a symbol id embeds the absolute path mid-value, after its
 * kind and a colon, so an anchored replacement would miss most of them.
 */
function relativize_strings(value: unknown, normalized_root: string): unknown {
  if (typeof value === "string") {
    return value.split(normalized_root).join("");
  }
  if (Array.isArray(value)) {
    return value.map((item) => relativize_strings(item, normalized_root));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = relativize_strings(item, normalized_root);
    }
    return out;
  }
  return value;
}

/**
 * The membership-only form: object keys sorted, arrays sorted by each
 * member's canonical JSON, so no list order survives into the digest.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item));
    const keyed = items.map((item) => ({ item, key: JSON.stringify(item) }));
    keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return keyed.map((entry) => entry.item);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [key, item] of entries) {
      out[key] = canonicalize(item);
    }
    return out;
  }
  return value;
}

export function fingerprint_diagnostics(
  entry_points: readonly EnrichedEntryPoint[],
  corpus_root: string,
): DiagnosticsFingerprint {
  const normalized_root = normalize_root(corpus_root);
  const relativized = entry_points.map((entry) =>
    relativize_strings(entry, normalized_root),
  );

  const raw_members = relativized.map((entry) => JSON.stringify(entry)).sort();
  const canonical_members = relativized
    .map((entry) => JSON.stringify(canonicalize(entry)))
    .sort();

  return {
    schema_version: DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
    entry_point_count: entry_points.length,
    diag_hash: digest_members(raw_members),
    canonical_hash: digest_members(canonical_members),
  };
}

/**
 * Whether two runs produced the same diagnostics payload. Counts are part of
 * the identity so an empty payload can never pass as equal to a full one
 * whose hashes happen never to be read.
 */
export function diagnostics_fingerprints_identical(
  baseline: DiagnosticsFingerprint,
  candidate: DiagnosticsFingerprint,
): boolean {
  if (baseline.schema_version !== candidate.schema_version) {
    throw new Error(
      `Refusing to compare diagnostics fingerprints across schema versions ${baseline.schema_version} and ${candidate.schema_version}: the hashes are not the same function.`,
    );
  }
  return (
    baseline.entry_point_count === candidate.entry_point_count &&
    baseline.diag_hash === candidate.diag_hash &&
    baseline.canonical_hash === candidate.canonical_hash
  );
}
