/**
 * Tests for ResolutionFailure diagnostic types.
 */

import { describe, test, expect } from "vitest";
import type {
  ResolutionFailure,
  ResolutionFailureStage,
  ResolutionFailureReason,
} from "./resolution_failure";
import type { FilePath } from "./location";
import type { SymbolId } from "./symbol";
import type { ScopeId } from "./scopes";

describe("ResolutionFailure diagnostics", () => {
  test("All ResolutionFailureStage values are usable", () => {
    const stages: ResolutionFailureStage[] = [
      "name_resolution",
      "receiver_resolution",
      "method_lookup",
      "import_resolution",
      "type_inference",
      "constructor_lookup",
      "collection_dispatch",
    ];
    expect(stages).toHaveLength(7);
  });

  test("All ResolutionFailureReason values are usable", () => {
    const reasons: ResolutionFailureReason[] = [
      "name_not_in_scope",
      "import_unresolved",
      "reexport_chain_unresolved",
      "receiver_type_unknown",
      "method_not_on_type",
      "polymorphic_no_implementations",
      "collection_dispatch_miss",
      "dynamic_dispatch",
      "no_enclosing_class_scope",
      "class_definition_not_found",
      "no_parent_class",
      "member_type_unknown",
      "definition_has_no_body_scope",
      "constructor_target_not_a_class",
    ];
    expect(reasons).toHaveLength(14);
  });

  test("ResolutionFailure.partial_info accepts optional fields", () => {
    const minimal: ResolutionFailure = {
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: {},
    };
    const full: ResolutionFailure = {
      stage: "method_lookup",
      reason: "method_not_on_type",
      partial_info: {
        resolved_receiver_type: "User" as SymbolId,
        import_target_file: "src/users.ts" as FilePath,
        last_known_scope: "scope_1" as ScopeId,
      },
    };

    expect(minimal.partial_info).toEqual({});
    expect(full.partial_info.resolved_receiver_type).toBe("User");
    expect(full.partial_info.import_target_file).toBe("src/users.ts");
  });
});
