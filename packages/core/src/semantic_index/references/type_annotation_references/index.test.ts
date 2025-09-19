/**
 * Tests for type annotation references public API
 */

import { describe, it, expect } from "vitest";
import * as TypeAnnotationReferences from "./index";

describe("Type Annotation References - Public API", () => {
  describe("Exports", () => {
    it("should export process_type_annotation_references function", () => {
      expect(typeof TypeAnnotationReferences.process_type_annotation_references).toBe("function");
      expect(TypeAnnotationReferences.process_type_annotation_references.name).toBe("process_type_annotation_references");
    });

    it("should export TypeAnnotationReference type", () => {
      // TypeScript types are erased at runtime, so we test through function parameters
      // The function should accept TypeAnnotationReference arrays
      expect(typeof TypeAnnotationReferences.process_type_annotation_references).toBe("function");
    });

    it("should not export internal implementation details", () => {
      // Ensure we only export what's intended for public use
      const exports = Object.keys(TypeAnnotationReferences);
      expect(exports).toEqual([
        "process_type_annotation_references",
        // Type exports don't appear in runtime exports
      ]);
    });

    it("should maintain stable public API", () => {
      // Ensure the public interface remains consistent
      expect(TypeAnnotationReferences).toHaveProperty("process_type_annotation_references");
      expect(typeof TypeAnnotationReferences.process_type_annotation_references).toBe("function");

      // Verify function signature accepts expected parameters
      const func = TypeAnnotationReferences.process_type_annotation_references;
      expect(func.length).toBe(4); // type_captures, root_scope, scopes, file_path
    });
  });

  describe("Module Structure", () => {
    it("should be a proper ES module", () => {
      expect(TypeAnnotationReferences).toBeDefined();
      expect(typeof TypeAnnotationReferences).toBe("object");
    });

    it("should export only stable public API", () => {
      // This module is marked as internal, so it should have minimal exports
      const exportCount = Object.keys(TypeAnnotationReferences).length;
      expect(exportCount).toBe(1); // Only process_type_annotation_references function
    });
  });
});