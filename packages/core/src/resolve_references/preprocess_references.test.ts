/**
 * Tests for Generic Reference Preprocessing Dispatcher
 *
 * Verifies that:
 * 1. Python files dispatch to preprocess_python_references
 * 2. TypeScript/JavaScript files are no-op
 * 3. Unknown languages are no-op
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { preprocess_references } from "./preprocess_references";
import { ReferenceRegistry } from "./registries/reference";
import { DefinitionRegistry } from "./registries/definition";
import type {
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  FunctionCallReference,
} from "@ariadnejs/types";
import type { ResolutionRegistry } from "./resolve_references";

import { preprocess_python_references } from "./preprocess_references.python";

// Mock the Python preprocessor
vi.mock("./preprocess_references.python", () => ({
  preprocess_python_references: vi.fn(),
}));

const TEST_FILE_PY = "test.py" as FilePath;
const TEST_FILE_TS = "test.ts" as FilePath;
const TEST_FILE_JS = "test.js" as FilePath;
const FILE_SCOPE_ID = "scope:test:file:0:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE_PY,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

describe("preprocess_references", () => {
  let references: ReferenceRegistry;
  let definitions: DefinitionRegistry;
  let resolutions: { resolve: () => null };

  beforeEach(() => {
    references = new ReferenceRegistry();
    definitions = new DefinitionRegistry();
    resolutions = { resolve: () => null };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call preprocess_python_references for Python files", () => {
    preprocess_references(
      TEST_FILE_PY,
      "python",
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    expect(preprocess_python_references).toHaveBeenCalledOnce();
    expect(preprocess_python_references).toHaveBeenCalledWith(
      TEST_FILE_PY,
      references,
      definitions,
      resolutions
    );
  });

  it("should not process TypeScript files (no-op)", () => {
    // Add a reference to verify it's not modified
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "someFunc" as SymbolName,
      location: { ...MOCK_LOCATION, file_path: TEST_FILE_TS },
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE_TS, [func_call]);

    preprocess_references(
      TEST_FILE_TS,
      "typescript",
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    // Python preprocessor should NOT be called
    expect(preprocess_python_references).not.toHaveBeenCalled();

    // References should be unchanged
    const refs = references.get_file_references(TEST_FILE_TS);
    expect(refs).toEqual([func_call]);
  });

  it("should not process JavaScript files (no-op)", () => {
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "someFunc" as SymbolName,
      location: { ...MOCK_LOCATION, file_path: TEST_FILE_JS },
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(TEST_FILE_JS, [func_call]);

    preprocess_references(
      TEST_FILE_JS,
      "javascript",
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    expect(preprocess_python_references).not.toHaveBeenCalled();

    const refs = references.get_file_references(TEST_FILE_JS);
    expect(refs).toEqual([func_call]);
  });

  it("should not process unknown languages (no-op)", () => {
    const unknown_file = "test.xyz" as FilePath;
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "someFunc" as SymbolName,
      location: { ...MOCK_LOCATION, file_path: unknown_file },
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(unknown_file, [func_call]);

    preprocess_references(
      unknown_file,
      "rust", // Not yet supported
      references,
      definitions,
      resolutions as unknown as ResolutionRegistry
    );

    expect(preprocess_python_references).not.toHaveBeenCalled();

    const refs = references.get_file_references(unknown_file);
    expect(refs).toEqual([func_call]);
  });
});
