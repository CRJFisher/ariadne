import { describe, it, expect, afterEach } from "vitest";
import type { AnyDefinition, FilePath, SymbolId } from "@ariadnejs/types";
import { MemberIndex } from "./member_index";
import { SubtypeGraph } from "./subtype_graph";
import {
  assert_reverse_indices_consistent,
  first_reverse_index_divergence,
} from "./reverse_index_invariant";

const ARM = "ARIADNE_ASSERT_REGISTRY_INVARIANTS";
const FILE = "a.ts" as FilePath;
const PARENT = "class:a.ts:1:0:2:1:Base" as SymbolId;
const SUBTYPE = "class:a.ts:3:0:4:1:Derived" as SymbolId;

afterEach(() => {
  delete process.env[ARM];
});

/** An empty member index, which holds no forward entry to disagree about. */
function agreeing_members(): MemberIndex {
  return new MemberIndex(new Map<SymbolId, AnyDefinition>());
}

function agreeing_heritage(): SubtypeGraph {
  return new SubtypeGraph();
}

/**
 * A heritage graph holding one edge whose reverse index has been emptied — the
 * write site that populates a forward map and forgets its reverse one, which is
 * the failure the invariant exists to make speak.
 */
function heritage_missing_its_reverse_index(): SubtypeGraph {
  const heritage = new SubtypeGraph();
  heritage.register_subtype(PARENT, SUBTYPE, "declared", FILE);
  heritage["parent_types"].clear();
  return heritage;
}

describe("the first divergence between the definition store's forward and reverse maps", () => {
  it("is nothing when every index agrees", () => {
    expect(first_reverse_index_divergence(agreeing_members(), agreeing_heritage())).toEqual(null);
  });

  it("is the heritage's divergence when its reverse index lost an edge the forward map holds", () => {
    expect(
      first_reverse_index_divergence(agreeing_members(), heritage_missing_its_reverse_index())
    ).toEqual(`parent_types is missing "${SUBTYPE}", which type_subtypes says has 1 entry — a write site populated type_subtypes without parent_types`);
  });
});

describe("the invariant as a guard", () => {
  it("passes a divergence over in silence while disarmed, which a corpus load relies on", () => {
    expect(() =>
      assert_reverse_indices_consistent(
        agreeing_members(),
        heritage_missing_its_reverse_index(),
        "update_file(a.ts)"
      )
    ).not.toThrow();
  });

  it("names both the write and the divergence when armed", () => {
    process.env[ARM] = "1";

    expect(() =>
      assert_reverse_indices_consistent(
        agreeing_members(),
        heritage_missing_its_reverse_index(),
        "update_file(a.ts)"
      )
    ).toThrow(
      `DefinitionRegistry reverse index diverged after update_file(a.ts): parent_types is missing "${SUBTYPE}", which type_subtypes says has 1 entry — a write site populated type_subtypes without parent_types`
    );
  });

  it("stays quiet when armed over indexes that agree", () => {
    process.env[ARM] = "1";

    expect(() =>
      assert_reverse_indices_consistent(
        agreeing_members(),
        agreeing_heritage(),
        "remove_file(a.ts)"
      )
    ).not.toThrow();
  });

  it("is disarmed by any value but 1, so a stray setting never costs a corpus load the pass", () => {
    process.env[ARM] = "true";

    expect(() =>
      assert_reverse_indices_consistent(
        agreeing_members(),
        heritage_missing_its_reverse_index(),
        "update_file(a.ts)"
      )
    ).not.toThrow();
  });
});
