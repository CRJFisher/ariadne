import { describe, expect, it } from "vitest";

import { compute_orphan_paths, type ResponseTarget } from "./orphan_cleanup.js";

describe("compute_orphan_paths", () => {
  it("returns empty when no responses in the current run", () => {
    const orphans = compute_orphan_paths(
      { a: "/b/check_a.ts" },
      [],
      [],
    );
    expect(orphans).toEqual([]);
  });

  it("keeps paths that were accepted by apply_proposals", () => {
    const orphans = compute_orphan_paths(
      { a: "/b/check_a.ts" },
      [{ group_id: "a", retargets_to: null }],
      ["/b/check_a.ts"],
    );
    expect(orphans).toEqual([]);
  });

  it("flags unaccepted paths whose target is claimed by this run", () => {
    const orphans = compute_orphan_paths(
      { a: "/b/check_a.ts" },
      [{ group_id: "a", retargets_to: null }],
      [],
    );
    expect(orphans).toEqual(["/b/check_a.ts"]);
  });

  it("ignores paths whose target is owned by a sibling run (multi-run sweep)", () => {
    // Authored map spans runs A, B, C. This finalize is for run B only;
    // responses in run B claim target 'b'. Targets 'a' and 'c' belong to
    // other runs and must not be deleted.
    const authored = {
      a: "/out/check_a.ts",
      b: "/out/check_b.ts",
      c: "/out/check_c.ts",
    };
    const run_b_responses: ResponseTarget[] = [{ group_id: "b", retargets_to: null }];
    const orphans = compute_orphan_paths(authored, run_b_responses, []);
    expect(orphans).toEqual(["/out/check_b.ts"]);
  });

  it("uses retargets_to when present to resolve the target group", () => {
    // Response dispatches against group_id=dispatch-grp but retargets to
    // existing-entry. The authored-files map is keyed on the target, so the
    // orphan predicate must consult retargets_to.
    const authored = { "existing-entry": "/out/check_existing-entry.ts" };
    const orphans = compute_orphan_paths(
      authored,
      [{ group_id: "dispatch-grp", retargets_to: "existing-entry" }],
      [],
    );
    expect(orphans).toEqual(["/out/check_existing-entry.ts"]);
  });

  it("handles mixed accepted / rejected paths within the same run", () => {
    const authored = {
      a: "/out/check_a.ts",
      b: "/out/check_b.ts",
    };
    const orphans = compute_orphan_paths(
      authored,
      [
        { group_id: "a", retargets_to: null },
        { group_id: "b", retargets_to: null },
      ],
      ["/out/check_a.ts"],
    );
    expect(orphans).toEqual(["/out/check_b.ts"]);
  });
});
