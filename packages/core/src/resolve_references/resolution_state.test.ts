/**
 * Unit Tests for Resolution State
 *
 * Tests the pure query and update functions that operate on ResolutionState.
 */

import { describe, it, expect } from "vitest";
import {
  create_resolution_state,
  type ResolutionState,
  type NameResolutionResult,
  type CallResolutionResult,
  resolve,
  get_calls_by_caller_scope,
  get_all_referenced_symbols,
  get_indirect_reachability,
  size,
  remove_file,
  apply_name_resolution,
  apply_call_resolution,
  clear,
} from "./resolution_state";
import { function_symbol } from "@ariadnejs/types";
import type {
  ScopeId,
  SymbolName,
  FilePath,
  Location,
  CallReference,
} from "@ariadnejs/types";
import type { IndirectReachabilityEntry } from "./indirect_reachability";

const TEST_FILE = "test.ts" as FilePath;
const FILE_A = "a.ts" as FilePath;
const FILE_B = "b.ts" as FilePath;
const SCOPE_A = "scope:a.ts:file:0:0" as ScopeId;
const SCOPE_B = "scope:b.ts:file:0:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

const MOCK_LOCATION_A: Location = {
  file_path: FILE_A,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

const MOCK_LOCATION_B: Location = {
  file_path: FILE_B,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

// ============================================================================
// Query Function Tests
// ============================================================================

describe("resolve", () => {
  it("should return SymbolId when resolution exists", () => {
    const symbol_id = function_symbol("greet", TEST_FILE, MOCK_LOCATION);
    const state: ResolutionState = {
      ...create_resolution_state(),
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["greet" as SymbolName, symbol_id]])],
      ]),
    };

    const result = resolve(state, SCOPE_A, "greet" as SymbolName);

    expect(result).toBe(symbol_id);
  });

  it("should return null when scope not found", () => {
    const state = create_resolution_state();

    const result = resolve(state, SCOPE_A, "greet" as SymbolName);

    expect(result).toBeNull();
  });

  it("should return null when name not found in scope", () => {
    const symbol_id = function_symbol("greet", TEST_FILE, MOCK_LOCATION);
    const state: ResolutionState = {
      ...create_resolution_state(),
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["greet" as SymbolName, symbol_id]])],
      ]),
    };

    const result = resolve(state, SCOPE_A, "unknown" as SymbolName);

    expect(result).toBeNull();
  });
});

describe("get_calls_by_caller_scope", () => {
  it("should return calls for existing scope", () => {
    const symbol_id = function_symbol("helper", TEST_FILE, MOCK_LOCATION);
    const call: CallReference = {
      call_type: "function",
      name: "helper" as SymbolName,
      location: MOCK_LOCATION,
      caller_scope_id: SCOPE_A,
      resolutions: [{ symbol_id, resolution_kind: "direct" }],
    };
    const state: ResolutionState = {
      ...create_resolution_state(),
      calls_by_caller_scope: new Map([[SCOPE_A, [call]]]),
    };

    const result = get_calls_by_caller_scope(state, SCOPE_A);

    expect(result).toEqual([call]);
  });

  it("should return empty array when scope has no calls", () => {
    const state = create_resolution_state();

    const result = get_calls_by_caller_scope(state, SCOPE_A);

    expect(result).toEqual([]);
  });
});

describe("get_all_referenced_symbols", () => {
  it("should return empty set for empty state", () => {
    const state = create_resolution_state();

    const result = get_all_referenced_symbols(state);

    expect(result.size).toBe(0);
  });

  it("should collect symbols from resolved calls", () => {
    const symbol_a = function_symbol("funcA", TEST_FILE, MOCK_LOCATION);
    const symbol_b = function_symbol("funcB", TEST_FILE, MOCK_LOCATION);

    const calls: CallReference[] = [
      {
        call_type: "function",
        name: "funcA" as SymbolName,
        location: MOCK_LOCATION,
        caller_scope_id: SCOPE_A,
        resolutions: [{ symbol_id: symbol_a, resolution_kind: "direct" }],
      },
      {
        call_type: "function",
        name: "funcB" as SymbolName,
        location: MOCK_LOCATION,
        caller_scope_id: SCOPE_A,
        resolutions: [{ symbol_id: symbol_b, resolution_kind: "direct" }],
      },
    ];

    const state: ResolutionState = {
      ...create_resolution_state(),
      resolved_calls_by_file: new Map([[TEST_FILE, calls]]),
    };

    const result = get_all_referenced_symbols(state);

    expect(result.size).toBe(2);
    expect(result.has(symbol_a)).toBe(true);
    expect(result.has(symbol_b)).toBe(true);
  });

  it("should collect symbols from multi-candidate resolutions", () => {
    const other_file = "other.ts" as FilePath;
    const other_location: Location = {
      file_path: other_file,
      start_line: 1,
      start_column: 0,
      end_line: 1,
      end_column: 10,
    };

    // Use different names to ensure different symbol IDs
    const symbol_a = function_symbol("overloadedA", TEST_FILE, MOCK_LOCATION);
    const symbol_b = function_symbol("overloadedB", other_file, other_location);

    const calls: CallReference[] = [
      {
        call_type: "function",
        name: "overloaded" as SymbolName,
        location: MOCK_LOCATION,
        caller_scope_id: SCOPE_A,
        resolutions: [
          { symbol_id: symbol_a, resolution_kind: "direct" },
          { symbol_id: symbol_b, resolution_kind: "direct" },
        ],
      },
    ];

    const state: ResolutionState = {
      ...create_resolution_state(),
      resolved_calls_by_file: new Map([[TEST_FILE, calls]]),
    };

    const result = get_all_referenced_symbols(state);

    expect(result.size).toBe(2);
    expect(result.has(symbol_a)).toBe(true);
    expect(result.has(symbol_b)).toBe(true);
  });

  it("should include indirectly reachable symbols", () => {
    const symbol_id = function_symbol("callback", TEST_FILE, MOCK_LOCATION);
    const entry: IndirectReachabilityEntry = {
      reason: {
        read_location: MOCK_LOCATION,
        access_path: ["callbacks", "0"],
      },
    };

    const state: ResolutionState = {
      ...create_resolution_state(),
      indirect_reachability: new Map([[symbol_id, entry]]),
    };

    const result = get_all_referenced_symbols(state);

    expect(result.size).toBe(1);
    expect(result.has(symbol_id)).toBe(true);
  });
});

describe("get_indirect_reachability", () => {
  it("should return empty map for empty state", () => {
    const state = create_resolution_state();

    const result = get_indirect_reachability(state);

    expect(result.size).toBe(0);
  });

  it("should return indirect reachability map", () => {
    const symbol_id = function_symbol("callback", TEST_FILE, MOCK_LOCATION);
    const entry: IndirectReachabilityEntry = {
      reason: {
        read_location: MOCK_LOCATION,
        access_path: ["handlers"],
      },
    };

    const state: ResolutionState = {
      ...create_resolution_state(),
      indirect_reachability: new Map([[symbol_id, entry]]),
    };

    const result = get_indirect_reachability(state);

    expect(result.size).toBe(1);
    expect(result.get(symbol_id)).toBe(entry);
  });
});

describe("size", () => {
  it("should return 0 for empty state", () => {
    const state = create_resolution_state();

    const result = size(state);

    expect(result).toBe(0);
  });

  it("should count resolutions across all scopes", () => {
    const symbol_a = function_symbol("funcA", TEST_FILE, MOCK_LOCATION);
    const symbol_b = function_symbol("funcB", TEST_FILE, MOCK_LOCATION);
    const symbol_c = function_symbol("funcC", TEST_FILE, MOCK_LOCATION);

    const state: ResolutionState = {
      ...create_resolution_state(),
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["funcA" as SymbolName, symbol_a]])],
        [
          SCOPE_B,
          new Map([
            ["funcB" as SymbolName, symbol_b],
            ["funcC" as SymbolName, symbol_c],
          ]),
        ],
      ]),
    };

    const result = size(state);

    expect(result).toBe(3);
  });
});

// ============================================================================
// Update Function Tests
// ============================================================================

describe("remove_file", () => {
  it("should remove resolutions for file's scopes", () => {
    const symbol_a = function_symbol("funcA", FILE_A, MOCK_LOCATION_A);
    const symbol_b = function_symbol("funcB", FILE_B, MOCK_LOCATION_B);

    const state: ResolutionState = {
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["funcA" as SymbolName, symbol_a]])],
        [SCOPE_B, new Map([["funcB" as SymbolName, symbol_b]])],
      ]),
      scope_to_file: new Map([
        [SCOPE_A, FILE_A],
        [SCOPE_B, FILE_B],
      ]),
      resolved_calls_by_file: new Map(),
      calls_by_caller_scope: new Map(),
      indirect_reachability: new Map(),
    };

    const result = remove_file(state, FILE_A);

    expect(result.resolutions_by_scope.has(SCOPE_A)).toBe(false);
    expect(result.resolutions_by_scope.has(SCOPE_B)).toBe(true);
    expect(result.scope_to_file.has(SCOPE_A)).toBe(false);
    expect(result.scope_to_file.has(SCOPE_B)).toBe(true);
  });

  it("should remove resolved calls for file", () => {
    const symbol_a = function_symbol("funcA", FILE_A, MOCK_LOCATION_A);

    const call: CallReference = {
      call_type: "function",
      name: "funcA" as SymbolName,
      location: MOCK_LOCATION_A,
      caller_scope_id: SCOPE_A,
      resolutions: [{ symbol_id: symbol_a, resolution_kind: "direct" }],
    };

    const state: ResolutionState = {
      ...create_resolution_state(),
      scope_to_file: new Map([[SCOPE_A, FILE_A]]),
      resolved_calls_by_file: new Map([[FILE_A, [call]]]),
    };

    const result = remove_file(state, FILE_A);

    expect(result.resolved_calls_by_file.has(FILE_A)).toBe(false);
  });

  it("should remove calls_by_caller_scope for file's scopes", () => {
    const symbol_a = function_symbol("helper", FILE_A, MOCK_LOCATION_A);

    const call: CallReference = {
      call_type: "function",
      name: "helper" as SymbolName,
      location: MOCK_LOCATION_A,
      caller_scope_id: SCOPE_A,
      resolutions: [{ symbol_id: symbol_a, resolution_kind: "direct" }],
    };

    const state: ResolutionState = {
      ...create_resolution_state(),
      scope_to_file: new Map([[SCOPE_A, FILE_A]]),
      calls_by_caller_scope: new Map([[SCOPE_A, [call]]]),
    };

    const result = remove_file(state, FILE_A);

    expect(result.calls_by_caller_scope.has(SCOPE_A)).toBe(false);
  });

  it("should remove indirect_reachability entries from file", () => {
    const symbol_a = function_symbol("callbackA", FILE_A, MOCK_LOCATION_A);
    const symbol_b = function_symbol("callbackB", FILE_B, MOCK_LOCATION_B);

    const entry_a: IndirectReachabilityEntry = {
      reason: {
        read_location: MOCK_LOCATION_A,
        access_path: ["handlers"],
      },
    };
    const entry_b: IndirectReachabilityEntry = {
      reason: {
        read_location: MOCK_LOCATION_B,
        access_path: ["handlers"],
      },
    };

    const state: ResolutionState = {
      ...create_resolution_state(),
      indirect_reachability: new Map([
        [symbol_a, entry_a],
        [symbol_b, entry_b],
      ]),
    };

    const result = remove_file(state, FILE_A);

    expect(result.indirect_reachability.has(symbol_a)).toBe(false);
    expect(result.indirect_reachability.has(symbol_b)).toBe(true);
  });

  it("should not mutate original state", () => {
    const symbol_a = function_symbol("funcA", FILE_A, MOCK_LOCATION_A);

    const state: ResolutionState = {
      ...create_resolution_state(),
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["funcA" as SymbolName, symbol_a]])],
      ]),
      scope_to_file: new Map([[SCOPE_A, FILE_A]]),
    };

    const result = remove_file(state, FILE_A);

    // Original state unchanged
    expect(state.resolutions_by_scope.has(SCOPE_A)).toBe(true);
    expect(state.scope_to_file.has(SCOPE_A)).toBe(true);

    // Result has file removed
    expect(result.resolutions_by_scope.has(SCOPE_A)).toBe(false);
  });
});

describe("apply_name_resolution", () => {
  it("should merge new resolutions into state", () => {
    const symbol_a = function_symbol("funcA", FILE_A, MOCK_LOCATION_A);
    const symbol_b = function_symbol("funcB", FILE_B, MOCK_LOCATION_B);

    const state: ResolutionState = {
      ...create_resolution_state(),
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["funcA" as SymbolName, symbol_a]])],
      ]),
      scope_to_file: new Map([[SCOPE_A, FILE_A]]),
    };

    const result_to_apply: NameResolutionResult = {
      resolutions_by_scope: new Map([
        [SCOPE_B, new Map([["funcB" as SymbolName, symbol_b]])],
      ]),
      scope_to_file: new Map([[SCOPE_B, FILE_B]]),
    };

    const result = apply_name_resolution(state, result_to_apply);

    expect(result.resolutions_by_scope.size).toBe(2);
    expect(result.resolutions_by_scope.has(SCOPE_A)).toBe(true);
    expect(result.resolutions_by_scope.has(SCOPE_B)).toBe(true);
    expect(result.scope_to_file.size).toBe(2);
  });

  it("should overwrite existing scope resolutions", () => {
    const symbol_old = function_symbol("funcOld", FILE_A, MOCK_LOCATION_A);
    const symbol_new = function_symbol("funcNew", FILE_A, MOCK_LOCATION_A);

    const state: ResolutionState = {
      ...create_resolution_state(),
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["func" as SymbolName, symbol_old]])],
      ]),
      scope_to_file: new Map([[SCOPE_A, FILE_A]]),
    };

    const result_to_apply: NameResolutionResult = {
      resolutions_by_scope: new Map([
        [SCOPE_A, new Map([["func" as SymbolName, symbol_new]])],
      ]),
      scope_to_file: new Map([[SCOPE_A, FILE_A]]),
    };

    const result = apply_name_resolution(state, result_to_apply);

    expect(result.resolutions_by_scope.get(SCOPE_A)!.get("func" as SymbolName)).toBe(
      symbol_new
    );
  });

  it("should not mutate original state", () => {
    const symbol_b = function_symbol("funcB", FILE_B, MOCK_LOCATION_B);

    const state = create_resolution_state();

    const result_to_apply: NameResolutionResult = {
      resolutions_by_scope: new Map([
        [SCOPE_B, new Map([["funcB" as SymbolName, symbol_b]])],
      ]),
      scope_to_file: new Map([[SCOPE_B, FILE_B]]),
    };

    const result = apply_name_resolution(state, result_to_apply);

    expect(state.resolutions_by_scope.size).toBe(0);
    expect(result.resolutions_by_scope.size).toBe(1);
  });
});

describe("apply_call_resolution", () => {
  it("should merge resolved calls into state", () => {
    const symbol_a = function_symbol("funcA", FILE_A, MOCK_LOCATION_A);

    const call: CallReference = {
      call_type: "function",
      name: "funcA" as SymbolName,
      location: MOCK_LOCATION_A,
      caller_scope_id: SCOPE_A,
      resolutions: [{ symbol_id: symbol_a, resolution_kind: "direct" }],
    };

    const state = create_resolution_state();

    const result_to_apply: CallResolutionResult = {
      resolved_calls_by_file: new Map([[FILE_A, [call]]]),
      calls_by_caller_scope: new Map([[SCOPE_A, [call]]]),
      indirect_reachability: new Map(),
    };

    const result = apply_call_resolution(state, result_to_apply);

    expect(result.resolved_calls_by_file.get(FILE_A)).toEqual([call]);
    expect(result.calls_by_caller_scope.get(SCOPE_A)).toEqual([call]);
  });

  it("should merge indirect reachability into state", () => {
    const symbol_id = function_symbol("callback", FILE_A, MOCK_LOCATION_A);
    const entry: IndirectReachabilityEntry = {
      reason: {
        read_location: MOCK_LOCATION_A,
        access_path: ["handlers"],
      },
    };

    const state = create_resolution_state();

    const result_to_apply: CallResolutionResult = {
      resolved_calls_by_file: new Map(),
      calls_by_caller_scope: new Map(),
      indirect_reachability: new Map([[symbol_id, entry]]),
    };

    const result = apply_call_resolution(state, result_to_apply);

    expect(result.indirect_reachability.get(symbol_id)).toBe(entry);
  });

  it("should not mutate original state", () => {
    const symbol_a = function_symbol("funcA", FILE_A, MOCK_LOCATION_A);

    const call: CallReference = {
      call_type: "function",
      name: "funcA" as SymbolName,
      location: MOCK_LOCATION_A,
      caller_scope_id: SCOPE_A,
      resolutions: [{ symbol_id: symbol_a, resolution_kind: "direct" }],
    };

    const state = create_resolution_state();

    const result_to_apply: CallResolutionResult = {
      resolved_calls_by_file: new Map([[FILE_A, [call]]]),
      calls_by_caller_scope: new Map([[SCOPE_A, [call]]]),
      indirect_reachability: new Map(),
    };

    const result = apply_call_resolution(state, result_to_apply);

    expect(state.resolved_calls_by_file.size).toBe(0);
    expect(result.resolved_calls_by_file.size).toBe(1);
  });
});

describe("clear", () => {
  it("should return empty state", () => {
    const result = clear();

    expect(result.resolutions_by_scope.size).toBe(0);
    expect(result.scope_to_file.size).toBe(0);
    expect(result.resolved_calls_by_file.size).toBe(0);
    expect(result.calls_by_caller_scope.size).toBe(0);
    expect(result.indirect_reachability.size).toBe(0);
  });
});
