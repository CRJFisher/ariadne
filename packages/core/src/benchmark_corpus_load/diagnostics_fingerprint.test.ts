/**
 * Pins the diagnostics-payload hash functions over a synthetic fixture, so a
 * change to the digest or the member grammar cannot silently revalue every
 * recorded baseline — the same rule the call-graph digest lives under.
 */

import { describe, expect, it } from "vitest";
import type { EnrichedEntryPoint, FilePath, GrepHit } from "@ariadnejs/types";
import {
  DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
  diagnostics_fingerprints_identical,
  fingerprint_diagnostics,
} from "./diagnostics_fingerprint";

const fp = (s: string) => s as FilePath;

const ROOT = "/measure/checkout-a/corpus";

function grep_hit(
  root: string,
  file: string,
  line: number,
  content: string,
): GrepHit {
  return { file_path: fp(`${root}/src/${file}`), line, content, captures: [] };
}

function build_payload(root: string): EnrichedEntryPoint[] {
  return [
    {
      name: "orphan",
      file_path: fp(`${root}/src/orphan.ts`),
      start_line: 3,
      kind: "function",
      signature: "function orphan(): void",
      tree_size: 1,
      is_exported: true,
      definition_features: {
        definition_is_object_literal_method: false,
        accessor_kind: null,
      },
      diagnostics: {
        grep_call_sites: [
          grep_hit(root, "caller_one.ts", 4, "orphan();"),
          grep_hit(root, "caller_two.ts", 9, "return orphan();"),
        ],
        grep_call_sites_outside_index: [],
        reference_sites: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
        has_uncaptured_indexed_grep_hit: true,
      },
    },
    {
      name: "unread",
      file_path: fp(`${root}/src/unread.ts`),
      start_line: 8,
      kind: "method",
      signature: "unread(): number",
      tree_size: 2,
      is_exported: false,
      access_modifier: "public",
      definition_features: {
        definition_is_object_literal_method: false,
        accessor_kind: "getter",
      },
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_outside_index: [],
        reference_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
        has_uncaptured_indexed_grep_hit: false,
      },
    },
  ];
}

describe("fingerprint_diagnostics", () => {
  it("reproduces the committed fixture hashes", () => {
    expect(fingerprint_diagnostics(build_payload(ROOT), ROOT)).toEqual({
      schema_version: DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
      entry_point_count: 2,
      diag_hash: "495e44312e6e629f",
      canonical_hash: "8ab63fa4d3b4d774",
    });
  });

  it("digests the same values wherever the corpus sits on disk", () => {
    const relocated_root = "/second/checkout-b";
    expect(
      fingerprint_diagnostics(build_payload(relocated_root), relocated_root),
    ).toEqual(fingerprint_diagnostics(build_payload(ROOT), ROOT));
  });

  it("ignores the payload array's own order", () => {
    const reversed = [...build_payload(ROOT)].reverse();
    expect(fingerprint_diagnostics(reversed, ROOT)).toEqual(
      fingerprint_diagnostics(build_payload(ROOT), ROOT),
    );
  });

  it("moves only the diag hash when an evidence list is reordered", () => {
    // The pair's whole point: diag differing while canonical holds reads as
    // "same evidence, different order" — the discrimination that exposed the
    // capped truncation as a membership defect rather than an ordering one.
    const reordered = build_payload(ROOT);
    reordered[0].diagnostics.grep_call_sites.reverse();
    expect(fingerprint_diagnostics(reordered, ROOT)).toEqual({
      schema_version: DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
      entry_point_count: 2,
      diag_hash: "df6d4a89f8de6512",
      canonical_hash: "8ab63fa4d3b4d774",
    });
  });

  it("moves both hashes when a piece of evidence disappears", () => {
    const dropped = build_payload(ROOT);
    dropped[0].diagnostics.grep_call_sites.pop();
    expect(fingerprint_diagnostics(dropped, ROOT)).toEqual({
      schema_version: DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
      entry_point_count: 2,
      diag_hash: "dc219bdc5b5a003e",
      canonical_hash: "40c8b481f3a6a0ab",
    });
  });

  it("refuses a relative corpus root", () => {
    expect(() =>
      fingerprint_diagnostics(build_payload(ROOT), "corpus"),
    ).toThrow(/must be absolute/);
  });
});

describe("diagnostics_fingerprints_identical", () => {
  const base = {
    schema_version: DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
    entry_point_count: 2,
    diag_hash: "495e44312e6e629f",
    canonical_hash: "8ab63fa4d3b4d774",
  };

  it("accepts a byte-identical pair", () => {
    expect(diagnostics_fingerprints_identical(base, { ...base })).toEqual(true);
  });

  it("rejects a pair whose entry counts differ even under equal hashes", () => {
    expect(
      diagnostics_fingerprints_identical(base, { ...base, entry_point_count: 3 }),
    ).toEqual(false);
  });

  it("rejects a pair whose diag hashes differ", () => {
    expect(
      diagnostics_fingerprints_identical(base, {
        ...base,
        diag_hash: "0000000000000000",
      }),
    ).toEqual(false);
  });

  it("refuses a comparison across schema versions", () => {
    expect(() =>
      diagnostics_fingerprints_identical(base, { ...base, schema_version: 2 }),
    ).toThrow(/schema versions/);
  });
});
