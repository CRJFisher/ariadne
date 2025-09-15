/**
 * Class hierarchy module - Refactored with configuration-driven pattern
 *
 * Combines generic processing with language-specific bespoke handlers
 * to build class hierarchies across all supported languages.
 */

import {
  ClassDefinition,
  ClassHierarchy,
  Language,
  FilePath,
  FileAnalysis,
} from "@ariadnejs/types";
import Parser from "tree-sitter";
import {
  build_generic_class_hierarchy,
  ClassHierarchyContext,
  BespokeHandlers,
  CLASS_HIERARCHY_CONTEXT,
} from "./class_hierarchy";
// TODO: Language-specific handlers will be replaced with tree-sitter queries

/**
 * Build class hierarchy using configuration-driven processing
 */
export function build_class_hierarchy(
  definitions: ClassDefinition[],
  contexts: Map<FilePath, ClassHierarchyContext>
): ClassHierarchy {
  // TODO: Implement using tree-sitter queries
  const handlers = new Map<Language, BespokeHandlers>();
  return build_generic_class_hierarchy(definitions, contexts, handlers);
}

// Re-export types and context
export { ClassHierarchyContext } from "./class_hierarchy";
export { CLASS_HIERARCHY_CONTEXT };
export type {
  ClassNode,
  ClassHierarchy,
  InheritanceEdge,
} from "@ariadnejs/types";

/**
 * Build class hierarchy from all file analyses
 *
 * Creates an inheritance tree from all class definitions, enabling
 * method resolution and polymorphic call analysis.
 */
export async function build_class_hierarchy_from_analyses(
  analyses: FileAnalysis[],
  file_name_to_tree: Map<FilePath, Parser.Tree>
): Promise<ClassHierarchy> {
  // Convert ClassInfo to ClassDefinition format
  const class_definitions: ClassDefinition[] = [];
  const contexts = new Map<FilePath, ClassHierarchyContext>();

  for (const analysis of analyses) {
    const file_tree = file_name_to_tree.get(analysis.file_path);
    if (!file_tree) {
      throw new Error(
        `Tree and source code not found for file: ${analysis.file_path}`
      );
    }
    // Create context for this file (without AST for now)
    contexts.set(analysis.file_path, {
      tree: file_tree,
      source_code: analysis.source_code,
      file_path: analysis.file_path,
      language: analysis.language,
      all_definitions: [], // Will be populated if needed
    });

    // Classes are already ClassDefinition in FileAnalysis
    for (const classDef of analysis.classes) {
      class_definitions.push(classDef);
    }
  }

  // Build the hierarchy using the updated implementation
  const hierarchy = build_class_hierarchy(class_definitions, contexts);

  // Track and validate interface implementations
  // The hierarchy already contains interface data from ClassDefinitions
  // This ensures the data is properly tracked
  track_interface_implementations(class_definitions, hierarchy);

  // Detect and validate method overrides
  // This provides additional override chain analysis beyond what the hierarchy tracks
  const override_map = detect_and_validate_method_overrides(
    hierarchy,
    class_definitions
  );

  // Store the override map for later use in enrichment
  // Note: The override_map could be stored in metadata or passed to enrichment phases
  // For now, we're validating and logging any discrepancies

  return hierarchy;
}

/**
 * Track and validate interface implementations for all classes
 *
 * This function ensures that classes properly implement their declared interfaces
 * and tracks the implementation relationships.
 */
function track_interface_implementations(
  class_definitions: ClassDefinition[],
  hierarchy: ClassHierarchy
): void {
  // The ClassNode already tracks interfaces via the interfaces field
  // This is populated from class_def.implements during hierarchy building
  // For now, we just validate that the data is present

  for (const class_def of class_definitions) {
    if (class_def.implements && class_def.implements.length > 0) {
      const classNode = hierarchy.classes.get(class_def.symbol);
      if (classNode) {
        // Verify interfaces are properly tracked
        if (!classNode.interfaces || classNode.interfaces.length === 0) {
          console.warn(
            `Class ${class_def.symbol} implements interfaces but they are not tracked in hierarchy`
          );
        }
      }
    }
  }
}

/**
 * Detect and validate method override information
 *
 * This function uses the method_override module to detect override relationships
 * and validate the hierarchy's override data.
 */
function detect_and_validate_method_overrides(
  hierarchy: ClassHierarchy,
  class_definitions: ClassDefinition[]
): any {
  // Import the function from method_override module
  const {
    detect_and_validate_method_overrides: detectOverrides,
  } = require("../method_override");
  return detectOverrides(hierarchy, class_definitions);
}
