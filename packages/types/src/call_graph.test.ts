/**
 * Tests for CallReference and its resolution_failure carriage.
 */

import { describe, test, expect } from "vitest";
import type { CallReference } from "./call_graph";
import type { Location, FilePath } from "./location";
import type { SymbolName, SymbolId } from "./symbol";
import type { ScopeId } from "./scopes";
import type { ResolutionFailure } from "./resolution_failure";

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
});
