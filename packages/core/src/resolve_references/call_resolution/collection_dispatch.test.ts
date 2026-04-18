/**
 * Tests for collection dispatch resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { DefinitionRegistry } from "../registries/definition";
import { ResolutionRegistry } from "../resolve_references";
import { set_test_resolutions } from "../resolve_references.test";
import { is_err, variable_symbol } from "@ariadnejs/types";
import type {
  FilePath,
  Location,
  MethodCallReference,
  ScopeId,
  SymbolId,
  SymbolName,
  VariableDefinition,
} from "@ariadnejs/types";

const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 0,
  end_line: 5,
  end_column: 10,
};

describe("resolve_collection_dispatch", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  it("should be a function", () => {
    expect(typeof resolve_collection_dispatch).toBe("function");
  });

  it("should fail with dynamic_dispatch when method call has no extractable receiver name", () => {
    // method_call with property_chain shorter than 2 — receiver name cannot be extracted
    const call_ref: MethodCallReference = {
      kind: "method_call",
      name: "go" as SymbolName,
      property_chain: ["go" as SymbolName], // length 1, no receiver
      scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      receiver_location: MOCK_LOCATION,
      is_optional_chain: false,
    };

    const result = resolve_collection_dispatch(call_ref, definitions, resolutions);

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error.stage).toBe("collection_dispatch");
      expect(result.error.reason).toBe("dynamic_dispatch");
    }
  });

  it("should fail with collection_dispatch_miss when target is a plain variable with no collection_source", () => {
    const var_id = variable_symbol("plain" as SymbolName, MOCK_LOCATION);
    const var_def: VariableDefinition = {
      kind: "variable",
      symbol_id: var_id,
      name: "plain" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
    };

    definitions.update_file(TEST_FILE, [var_def]);

    const scope_resolutions = new Map<SymbolName, SymbolId>();
    scope_resolutions.set("plain" as SymbolName, var_id);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

    const call_ref: MethodCallReference = {
      kind: "method_call",
      name: "fn" as SymbolName,
      property_chain: ["plain" as SymbolName, "fn" as SymbolName],
      scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      receiver_location: MOCK_LOCATION,
      is_optional_chain: false,
    };

    const result = resolve_collection_dispatch(call_ref, definitions, resolutions);

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error.stage).toBe("collection_dispatch");
      expect(result.error.reason).toBe("collection_dispatch_miss");
    }
  });
});
