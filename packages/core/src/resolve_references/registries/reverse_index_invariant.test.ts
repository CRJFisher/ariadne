import { describe, it, expect, afterEach } from "vitest";
import {
  assert_reverse_indices_consistent,
  first_reverse_index_divergence,
} from "./reverse_index_invariant";

const ARM = "ARIADNE_ASSERT_REGISTRY_INVARIANTS";

afterEach(() => {
  delete process.env[ARM];
});

function agreeing() {
  return { verify: () => null };
}

function diverging(divergence: string) {
  return { verify: () => divergence };
}

describe("the first divergence between a store's forward and reverse maps", () => {
  it("is nothing when both indexes agree", () => {
    expect(first_reverse_index_divergence(agreeing(), agreeing())).toEqual(null);
  });

  it("is the members' divergence when the members disagree", () => {
    expect(first_reverse_index_divergence(diverging("members_by_file is missing"), agreeing())).toEqual(
      "members_by_file is missing"
    );
  });

  it("is the heritage's divergence when only the heritage disagrees", () => {
    expect(first_reverse_index_divergence(agreeing(), diverging("subtypes is missing"))).toEqual(
      "subtypes is missing"
    );
  });

  it("is the members' divergence when both disagree, so the first found is reported", () => {
    expect(
      first_reverse_index_divergence(diverging("members first"), diverging("heritage second"))
    ).toEqual("members first");
  });
});

describe("the invariant as a guard", () => {
  it("passes a divergence over in silence while disarmed, which a corpus load relies on", () => {
    expect(() =>
      assert_reverse_indices_consistent(diverging("members_by_file is missing"), agreeing(), "update_file(a.ts)")
    ).not.toThrow();
  });

  it("names both the write and the divergence when armed", () => {
    process.env[ARM] = "1";

    expect(() =>
      assert_reverse_indices_consistent(
        diverging("members_by_file is missing"),
        agreeing(),
        "update_file(a.ts)"
      )
    ).toThrow(
      "DefinitionRegistry reverse index diverged after update_file(a.ts): members_by_file is missing"
    );
  });

  it("stays quiet when armed over indexes that agree", () => {
    process.env[ARM] = "1";

    expect(() =>
      assert_reverse_indices_consistent(agreeing(), agreeing(), "remove_file(a.ts)")
    ).not.toThrow();
  });

  it("is disarmed by any value but 1, so a stray setting never costs a corpus load the pass", () => {
    process.env[ARM] = "true";

    expect(() =>
      assert_reverse_indices_consistent(diverging("members_by_file is missing"), agreeing(), "update_file(a.ts)")
    ).not.toThrow();
  });
});
