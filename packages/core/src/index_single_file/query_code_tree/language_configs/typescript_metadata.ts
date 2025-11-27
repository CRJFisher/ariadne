/**
 * TypeScript-specific metadata extraction functions
 *
 * Extends JavaScript metadata extraction with TypeScript-specific features
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath } from "@ariadnejs/types";
import { type_symbol } from "@ariadnejs/types";
import type { MetadataExtractors } from "./metadata_types";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./javascript_metadata";
import { node_to_location } from "../../node_utils";

/**
 * TypeScript metadata extractors implementation
 *
 * Extends JavaScript extractors with TypeScript-specific handling
 */
export const TYPESCRIPT_METADATA_EXTRACTORS: MetadataExtractors = {
  /**
   * Extract type information from TypeScript type references
   *
   * Handles cases where the node IS the type reference (type_identifier)
   * rather than a node that HAS a type annotation
   */
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined {
    // If the node itself is a type reference, extract it directly
    if (node.type === "type_identifier") {
      const location: Location = node_to_location(node, file_path);

      return {
        type_id: type_symbol(node.text as SymbolName, location),
        type_name: node.text as SymbolName,
        certainty: "declared",
        is_nullable: false,
      };
    }

    // If it's a generic type, extract the base type
    // Note: type_arguments are not currently stored in TypeInfo - they would be
    // part of the type_id encoding if needed
    if (node.type === "generic_type") {
      const name_node = node.childForFieldName("name");

      if (name_node) {
        const location: Location = node_to_location(node, file_path);

        return {
          type_id: type_symbol(name_node.text as SymbolName, location),
          type_name: name_node.text as SymbolName,
          certainty: "declared",
          is_nullable: false,
        };
      }
    }

    // Handle interface/enum property access (e.g., Status.Active)
    if (node.type === "nested_type_identifier") {
      const location: Location = node_to_location(node, file_path);

      return {
        type_id: type_symbol(node.text as SymbolName, location),
        type_name: node.text as SymbolName,
        certainty: "declared",
        is_nullable: false,
      };
    }

    // Fall back to JavaScript extractor for other cases
    return JAVASCRIPT_METADATA_EXTRACTORS.extract_type_from_annotation(node, file_path);
  },

  // Delegate other methods to JavaScript extractors
  extract_call_receiver: JAVASCRIPT_METADATA_EXTRACTORS.extract_call_receiver,
  extract_property_chain: JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain,
  extract_receiver_info: JAVASCRIPT_METADATA_EXTRACTORS.extract_receiver_info,
  extract_assignment_parts: JAVASCRIPT_METADATA_EXTRACTORS.extract_assignment_parts,
  extract_construct_target: JAVASCRIPT_METADATA_EXTRACTORS.extract_construct_target,
  extract_type_arguments: JAVASCRIPT_METADATA_EXTRACTORS.extract_type_arguments,
  extract_is_optional_chain: JAVASCRIPT_METADATA_EXTRACTORS.extract_is_optional_chain,
  is_method_call: JAVASCRIPT_METADATA_EXTRACTORS.is_method_call,
  extract_call_name: JAVASCRIPT_METADATA_EXTRACTORS.extract_call_name,
};