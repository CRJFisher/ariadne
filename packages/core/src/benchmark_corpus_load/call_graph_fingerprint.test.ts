/**
 * The seven components, over hand-built graphs.
 *
 * The graphs here are literals rather than a loaded corpus, so each test names
 * exactly the one thing it is about. The corpus-scale counterpart — the guard
 * that runs against a real load on every test run — is
 * `call_graph_fingerprint.corpus.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type {
  CallReference,
  FilePath,
  IndirectReachability,
  Location,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import {
  assert_members_are_relative,
  compare_fingerprints,
  compare_recorded_fingerprints,
  fingerprint_call_graph,
  record_fingerprint,
  FINGERPRINT_COMPONENT_NAMES,
  FINGERPRINT_SCHEMA_VERSION,
  type CallSource,
  type FingerprintableGraph,
  type FingerprintComponentName,
} from "./call_graph_fingerprint";
import { digest_members } from "./streaming_digest";

const ROOT = "/corpus";

function location(file: string, line: number): Location {
  return {
    file_path: `${ROOT}/${file}` as FilePath,
    start_line: line,
    start_column: 0,
    end_line: line,
    end_column: 8,
  };
}

function call(
  file: string,
  line: number,
  name: string,
  targets: readonly string[],
): CallReference {
  return {
    location: location(file, line),
    name: name as SymbolName,
    scope_id: `${ROOT}/${file}:0` as ScopeId,
    call_type: "function",
    resolutions: targets.map((symbol_id) => ({
      symbol_id: symbol_id as SymbolId,
      confidence: "certain" as const,
      reason: { type: "direct" as const },
    })),
  };
}

const ALPHA = `function:${ROOT}/a.ts:1:0:3:1:alpha` as SymbolId;
const BETA = `function:${ROOT}/b.ts:1:0:3:1:beta` as SymbolId;
const ORPHAN = `function:${ROOT}/c.ts:1:0:3:1:orphan` as SymbolId;

/** A call `alpha` makes to `beta`, twice, plus one unresolved call. */
const ALPHA_CALLS: readonly CallReference[] = [
  call("a.ts", 10, "beta", [BETA]),
  call("a.ts", 11, "beta", [BETA]),
  call("a.ts", 12, "missing", []),
];

/** A call written at module scope — no node encloses it. */
const MODULE_CALL = call("a.ts", 20, "alpha", [ALPHA]);

function build_graph(
  indirect: ReadonlyMap<SymbolId, IndirectReachability>,
): FingerprintableGraph {
  return {
    nodes: new Map([
      [ALPHA, { enclosed_calls: ALPHA_CALLS }],
      [BETA, { enclosed_calls: [] }],
      [ORPHAN, { enclosed_calls: [] }],
    ]),
    entry_points: [ORPHAN, ALPHA],
    indirect_reachability: indirect,
  };
}

const COLLECTION_EVIDENCE: ReadonlyMap<SymbolId, IndirectReachability> = new Map(
  [
    [
      BETA,
      {
        reason: {
          type: "collection_read" as const,
          collection_id: `variable:${ROOT}/r.ts:3:0:3:8:HANDLERS` as SymbolId,
          read_location: location("r.ts", 6),
        },
      },
    ],
    [
      ORPHAN,
      {
        reason: {
          type: "function_reference" as const,
          read_location: location("r.ts", 9),
        },
      },
    ],
  ],
);

function call_source(calls: readonly CallReference[]): CallSource {
  return {
    get_calls_for_file: (file_id: FilePath) =>
      calls.filter((entry) => entry.location.file_path === file_id),
  };
}

function fingerprint_of(
  indirect: ReadonlyMap<SymbolId, IndirectReachability> = COLLECTION_EVIDENCE,
  calls: readonly CallReference[] = [...ALPHA_CALLS, MODULE_CALL],
) {
  return fingerprint_call_graph({
    call_graph: build_graph(indirect),
    resolutions: call_source(calls),
    indexed_files: [`${ROOT}/a.ts` as FilePath],
    dropped_files: new Set([`${ROOT}/broken.js` as FilePath]),
    corpus_root: ROOT,
  });
}

describe("the seven components", () => {
  it("names seven components, in the order every report lists them", () => {
    expect([...FINGERPRINT_COMPONENT_NAMES]).toEqual([
      "nodes",
      "call_edges",
      "unresolved_calls",
      "raw_entry_points",
      "indirect_reachability_keys",
      "dropped_files",
      "indirect_reachability_evidence",
    ]);
  });

  it("holds every member relative to the corpus root", () => {
    const fingerprint = fingerprint_of();
    expect([...fingerprint.nodes.members]).toEqual([
      "function:a.ts:1:0:3:1:alpha",
      "function:b.ts:1:0:3:1:beta",
      "function:c.ts:1:0:3:1:orphan",
    ]);
  });

  it("counts a caller-to-callee pair once, carrying its call-site count", () => {
    // `alpha` reaches `beta` from two call sites. One member keeps the
    // component the size AC #2 asks for; the `#2` keeps the multiplicity that
    // nothing else in the fingerprint pins.
    const fingerprint = fingerprint_of();
    expect([...fingerprint.call_edges.members]).toEqual([
      "function:a.ts:1:0:3:1:alpha->function:b.ts:1:0:3:1:beta#2",
      "module:a.ts->function:a.ts:1:0:3:1:alpha#1",
    ]);
  });

  it("attributes a module-scope call to a synthetic module caller", () => {
    // A call at module scope has no enclosing function scope, so no node holds
    // it. Enumerating from the call source rather than from the nodes is what
    // makes it visible at all.
    const fingerprint = fingerprint_of();
    const module_edges = fingerprint.call_edges.members.filter((member) =>
      member.startsWith("module:"),
    );
    expect(module_edges).toEqual([
      "module:a.ts->function:a.ts:1:0:3:1:alpha#1",
    ]);
  });

  it("names each unresolved call site with its caller", () => {
    const fingerprint = fingerprint_of();
    expect([...fingerprint.unresolved_calls.members]).toEqual([
      "function:a.ts:1:0:3:1:alpha|function|missing@a.ts:12:0:12:8",
    ]);
  });

  it("records both indirect-reachability variants, and only one carries a collection", () => {
    const fingerprint = fingerprint_of();
    expect([...fingerprint.indirect_reachability_evidence.members]).toEqual([
      "function:b.ts:1:0:3:1:beta|collection_read|variable:r.ts:3:0:3:8:HANDLERS|r.ts:6:0:6:8",
      "function:c.ts:1:0:3:1:orphan|function_reference||r.ts:9:0:9:8",
    ]);
  });

  it("holds the dropped files the load could not index", () => {
    const fingerprint = fingerprint_of();
    expect([...fingerprint.dropped_files.members]).toEqual(["broken.js"]);
  });

  it("derives each component's hash from its own members", () => {
    // The whole guard rests on this: a committed hash is the digest of a
    // committed, readable member list, not a number the code happened to emit.
    const fingerprint = fingerprint_of();
    for (const name of FINGERPRINT_COMPONENT_NAMES) {
      expect(fingerprint[name].hash).toEqual(
        digest_members(fingerprint[name].members),
      );
      expect(fingerprint[name].count).toEqual(fingerprint[name].members.length);
    }
  });
});

describe("the seventh number", () => {
  it("reports a moved read site, and moves nothing else", () => {
    // This is the failure the six-value fingerprint let through: the evidence
    // for an indirect reachability moved from one read site to another, which
    // never changes entry-point membership and so was invisible everywhere
    // else. If the seventh component is dropped, or evidence is hashed without
    // its read site, this test fails.
    const moved: ReadonlyMap<SymbolId, IndirectReachability> = new Map([
      ...COLLECTION_EVIDENCE,
      [
        ORPHAN,
        {
          reason: {
            type: "function_reference" as const,
            read_location: location("r.ts", 99),
          },
        },
      ],
    ]);

    const comparison = compare_fingerprints(fingerprint_of(), fingerprint_of(moved));

    expect([...comparison.differing_components]).toEqual([
      "indirect_reachability_evidence",
    ]);
    expect(comparison.identical).toEqual(false);
  });

  it("names the member that moved in each direction", () => {
    const moved: ReadonlyMap<SymbolId, IndirectReachability> = new Map([
      ...COLLECTION_EVIDENCE,
      [
        ORPHAN,
        {
          reason: {
            type: "function_reference" as const,
            read_location: location("r.ts", 99),
          },
        },
      ],
    ]);
    const comparison = compare_fingerprints(fingerprint_of(), fingerprint_of(moved));
    const evidence = comparison.components.find(
      (component) => component.component === "indirect_reachability_evidence",
    );

    expect(evidence?.only_baseline).toEqual([
      "function:c.ts:1:0:3:1:orphan|function_reference||r.ts:9:0:9:8",
    ]);
    expect(evidence?.only_candidate).toEqual([
      "function:c.ts:1:0:3:1:orphan|function_reference||r.ts:99:0:99:8",
    ]);
    expect(evidence?.only_baseline_total).toEqual(1);
    expect(evidence?.only_candidate_total).toEqual(1);
  });
});

describe("the comparison is live on every component", () => {
  // A multi-order run that reports "no difference" is worth exactly as much as
  // the demonstration that it could have reported one. Proving that here, over
  // a synthetic fingerprint, costs nothing; proving it against a corpus-scale
  // fingerprint would re-sort and re-digest two million members seven times on
  // every verdict, for a result that does not depend on the data.
  const PERTURBATION = "!liveness-probe";

  for (const name of FINGERPRINT_COMPONENT_NAMES) {
    it(`sees "${name}" move, and reports no other component moving`, () => {
      const baseline = fingerprint_of();
      const members = [...baseline[name].members, PERTURBATION].sort();
      const perturbed = {
        ...baseline,
        [name]: {
          count: members.length,
          hash: digest_members(members),
          members,
        },
      };

      const comparison = compare_fingerprints(baseline, perturbed);
      expect([...comparison.differing_components]).toEqual([name]);
    });
  }
});

describe("refusals", () => {
  it("refuses a fingerprint that still embeds an absolute path", () => {
    // A member that kept its absolute path makes the fingerprint a function of
    // where the corpus sits on disk, so a committed baseline could never match
    // another checkout's recomputation.
    expect(() =>
      fingerprint_call_graph({
        call_graph: build_graph(COLLECTION_EVIDENCE),
        resolutions: call_source([]),
        indexed_files: [],
        dropped_files: new Set([`${ROOT}/broken.js` as FilePath]),
        corpus_root: "/somewhere-else",
      }),
    ).toThrow(/holds an absolute path/);
  });

  it("refuses to compare two fingerprints recorded under different schemas", () => {
    const recorded = record_fingerprint(fingerprint_of());
    const older = { ...recorded, schema_version: recorded.schema_version - 1 };
    expect(() => compare_recorded_fingerprints(older, recorded)).toThrow(
      /Refusing to compare fingerprints across schema versions/,
    );
  });

  it("accepts a fingerprint whose members are all relative", () => {
    const fingerprint = fingerprint_of();
    assert_members_are_relative(fingerprint);
    expect(fingerprint.nodes.count).toEqual(3);
  });
});

describe("record_fingerprint", () => {
  it("carries the schema version and drops the members", () => {
    const recorded = record_fingerprint(fingerprint_of());
    expect(recorded.schema_version).toEqual(FINGERPRINT_SCHEMA_VERSION);
    const names = Object.keys(recorded.components) as FingerprintComponentName[];
    expect(names).toEqual([...FINGERPRINT_COMPONENT_NAMES]);
    expect(recorded.components.nodes).toEqual({
      count: 3,
      hash: digest_members([
        "function:a.ts:1:0:3:1:alpha",
        "function:b.ts:1:0:3:1:beta",
        "function:c.ts:1:0:3:1:orphan",
      ]),
    });
  });
});
