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
import { ResolutionRegistry } from "./resolve_references";

import { preprocess_python_references } from "./preprocess_references.python";

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
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    references = new ReferenceRegistry();
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches Python files to preprocess_python_references", () => {
    preprocess_references(
      TEST_FILE_PY,
      "python",
      references,
      definitions,
      resolutions
    );

    expect(preprocess_python_references).toHaveBeenCalledOnce();
    expect(preprocess_python_references).toHaveBeenCalledWith(
      TEST_FILE_PY,
      references,
      definitions,
      resolutions
    );
  });

  it("leaves TypeScript references untouched", () => {
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
      resolutions
    );

    expect(preprocess_python_references).not.toHaveBeenCalled();

    const refs = references.get_file_references(TEST_FILE_TS);
    expect(refs).toEqual([func_call]);
  });

  it("leaves JavaScript references untouched", () => {
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
      resolutions
    );

    expect(preprocess_python_references).not.toHaveBeenCalled();

    const refs = references.get_file_references(TEST_FILE_JS);
    expect(refs).toEqual([func_call]);
  });

  it("leaves Rust references untouched", () => {
    const rust_file = "test.rs" as FilePath;
    const func_call: FunctionCallReference = {
      kind: "function_call",
      name: "someFunc" as SymbolName,
      location: { ...MOCK_LOCATION, file_path: rust_file },
      scope_id: FILE_SCOPE_ID,
    };
    references.update_file(rust_file, [func_call]);

    preprocess_references(
      rust_file,
      "rust",
      references,
      definitions,
      resolutions
    );

    expect(preprocess_python_references).not.toHaveBeenCalled();

    const refs = references.get_file_references(rust_file);
    expect(refs).toEqual([func_call]);
  });
});
