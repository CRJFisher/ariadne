/**
 * Class hierarchy builder stub
 *
 * TODO: Implement using tree-sitter queries from class_hierarchy_queries/*.scm
 */

import {
  ClassHierarchy,
  Language,
  ClassDefinition,
  FilePath,
  SourceCode,
  FileAnalysis,
} from "@ariadnejs/types";
import Parser from "tree-sitter";
import { detect_and_validate_method_overrides } from "../method_override";

/**
 * Context for building class hierarchy
 */
export interface ClassHierarchyContext {
  tree: any; // Parser.Tree
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  all_definitions?: ClassDefinition[];
}

/**
 * Build class hierarchy using generic processing
 */
export function build_generic_class_hierarchy(
  definitions: ClassDefinition[],
  contexts: Map<FilePath, ClassHierarchyContext>
): ClassHierarchy {
  // TODO: Implement using tree-sitter queries from class_hierarchy_queries/*.scm
  return {
    classes: new Map(),
    inheritance_edges: [],
    root_classes: new Set(),
    metadata: {
      build_time: Date.now(),
      total_classes: 0,
      max_depth: 0,
    },
  };
}
/**
 * Track and validate interface implementations for all classes
 *
 * This function ensures that classes properly implement their declared interfaces
 * and tracks the implementation relationships.
 */
export function track_interface_implementations(
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
 * Build class hierarchy from all file analyses
 *
 * Creates an inheritance tree from all class definitions, enabling
 * method resolution and polymorphic call analysis.
 */

export function build_class_hierarchy_from_analyses(
  analyses: FileAnalysis[],
  file_name_to_tree: Map<FilePath, Parser.Tree>
): ClassHierarchy {
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
  const hierarchy = build_generic_class_hierarchy(class_definitions, contexts);

  // Track and validate interface implementations
  // The hierarchy already contains interface data from ClassDefinitions
  // This ensures the data is properly tracked
  track_interface_implementations(class_definitions, hierarchy);

  // Detect and validate method overrides
  // This provides additional override chain analysis beyond what the hierarchy tracks
  const override_map = detect_and_validate_method_overrides(
    class_definitions,
    hierarchy
  );

  // Store the override map for later use in enrichment
  // Note: The override_map could be stored in metadata or passed to enrichment phases
  // For now, we're validating and logging any discrepancies
  return hierarchy;
}
