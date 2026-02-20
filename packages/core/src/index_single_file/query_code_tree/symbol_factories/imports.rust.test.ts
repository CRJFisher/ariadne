/**
 * Tests for Rust import extraction
 */

import { describe, it, expect } from "vitest";
import {
  extract_imports_from_use_declaration,
  extract_import_from_extern_crate,
} from "./imports.rust";

describe("Rust Import Extraction Exports", () => {
  it("should export extract_imports_from_use_declaration", () => {
    expect(typeof extract_imports_from_use_declaration).toBe("function");
  });

  it("should export extract_import_from_extern_crate", () => {
    expect(typeof extract_import_from_extern_crate).toBe("function");
  });
});
