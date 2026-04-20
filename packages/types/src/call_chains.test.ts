/**
 * Tests for CallReference and ResolutionFailure types.
 */

import { describe, test, expect } from "vitest";
import type {
  CallReference,
  Location,
  SymbolName,
  SymbolId,
  FilePath,
  ScopeId,
  ResolutionFailure,
  ResolutionFailureStage,
  ResolutionFailureReason,
} from "./call_chains";

const TEST_FILE = "test.ts" as FilePath;
const TEST_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 5,
};

describe("CallReference", () => {
  test("with empty resolutions (failed)", () => {
    const call: CallReference = {
      location: { ...TEST_LOCATION, start_line: 5, end_line: 5 },
      name: "unknownFunc" as SymbolName,
      scope_id: "scope_1" as ScopeId,
      call_type: "function",
      resolutions: [],
    };

    expect(call.resolutions).toHaveLength(0);
  });

  test("with single resolution", () => {
    const call: CallReference = {
      location: { ...TEST_LOCATION, start_line: 10, end_line: 10 },
      name: "getName" as SymbolName,
      scope_id: "scope_2" as ScopeId,
      call_type: "method",
      resolutions: [
        {
          symbol_id: "User.getName" as SymbolId,
          confidence: "certain",
          reason: { type: "direct" },
        },
      ],
    };

    expect(call.resolutions).toHaveLength(1);
    expect(call.resolutions[0].symbol_id).toBe("User.getName");
  });

  test("with multiple resolutions (polymorphic)", () => {
    const call: CallReference = {
      location: { ...TEST_LOCATION, start_line: 15, end_line: 15 },
      name: "handle" as SymbolName,
      scope_id: "scope_3" as ScopeId,
      call_type: "method",
      resolutions: [
        {
          symbol_id: "HandlerA.handle" as SymbolId,
          confidence: "certain",
          reason: {
            type: "interface_implementation",
            interface_id: "Handler" as SymbolId,
          },
        },
        {
          symbol_id: "HandlerB.handle" as SymbolId,
          confidence: "certain",
          reason: {
            type: "interface_implementation",
            interface_id: "Handler" as SymbolId,
          },
        },
      ],
    };

    expect(call.resolutions).toHaveLength(2);
    expect(call.resolutions.every((r) => r.confidence === "certain")).toBe(true);
    expect(
      call.resolutions.every((r) => r.reason.type === "interface_implementation")
    ).toBe(true);
  });
});

describe("ResolutionFailure diagnostics", () => {
  test("CallReference omits resolution_failure on success", () => {
    const call: CallReference = {
      location: TEST_LOCATION,
      name: "ok" as SymbolName,
      scope_id: "scope_1" as ScopeId,
      call_type: "function",
      resolutions: [
        {
          symbol_id: "ok_target" as SymbolId,
          confidence: "certain",
          reason: { type: "direct" },
        },
      ],
    };

    expect(call.resolution_failure).toBeUndefined();
    expect(Object.hasOwn(call, "resolution_failure")).toBe(false);
  });

  test("CallReference carries resolution_failure on failure", () => {
    const failure: ResolutionFailure = {
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: "scope_1" as ScopeId },
    };
    const call: CallReference = {
      location: TEST_LOCATION,
      name: "missing" as SymbolName,
      scope_id: "scope_1" as ScopeId,
      call_type: "function",
      resolutions: [],
      resolution_failure: failure,
    };

    expect(call.resolutions).toHaveLength(0);
    expect(call.resolution_failure).toEqual(failure);
  });

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
