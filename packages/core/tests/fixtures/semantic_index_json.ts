/**
 * JSON representation of SemanticIndex
 *
 * This module defines types for serializing and deserializing SemanticIndex objects
 * to/from JSON format. The JSON representation is used for test fixtures.
 *
 * Key design decisions:
 * - ReadonlyMap<K, V> → Record<string, V>: Maps serialize to plain objects for
 *   human-readable, diffable JSON
 * - Branded types (SymbolId, ScopeId, etc.) remain as strings in JSON
 * - All SemanticIndex fields are preserved without information loss
 * - Empty collections serialize as {} or [] to make schema clear
 */

import fs from "fs";
import path from "path";
import type {
  FilePath,
  Language,
  ScopeId,
  SymbolId,
  LexicalScope,
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  EnumDefinition,
  NamespaceDefinition,
  TypeAliasDefinition,
  ImportDefinition,
  SymbolReference,
} from "@ariadnejs/types";

/**
 * JSON representation of SemanticIndex
 *
 * This is the schema used for test fixtures. ReadonlyMaps are converted to
 * objects with string keys. The JSON format is:
 * - Human-readable and diffable
 * - Complete representation (no information loss)
 * - Standard JSON (no custom serialization)
 */
export interface SemanticIndexJSON {
  /** Path to the source file */
  file_path: string;

  /** Programming language */
  language: string;

  /** Root scope identifier (module/file scope) */
  root_scope_id: string;

  /** Scope tree - maps scope IDs to scope data */
  scopes: Record<string, LexicalScope>;

  /** Function definitions - maps symbol IDs to definitions */
  functions: Record<string, FunctionDefinition>;

  /** Class definitions - maps symbol IDs to definitions */
  classes: Record<string, ClassDefinition>;

  /** Variable definitions - maps symbol IDs to definitions */
  variables: Record<string, VariableDefinition>;

  /** Interface definitions - maps symbol IDs to definitions */
  interfaces: Record<string, InterfaceDefinition>;

  /** Enum definitions - maps symbol IDs to definitions */
  enums: Record<string, EnumDefinition>;

  /** Namespace definitions - maps symbol IDs to definitions */
  namespaces: Record<string, NamespaceDefinition>;

  /** Type alias definitions - maps symbol IDs to definitions */
  types: Record<string, TypeAliasDefinition>;

  /** Import definitions - maps symbol IDs to definitions */
  imported_symbols: Record<string, ImportDefinition>;

  /** Symbol references (calls, member access, etc.) */
  references: SymbolReference[];
}

/**
 * Serializes a SemanticIndex to JSON format
 *
 * Converts ReadonlyMaps to plain objects for JSON serialization.
 * The resulting object can be stringified with JSON.stringify().
 *
 * @param index - The SemanticIndex to serialize
 * @returns JSON-serializable object
 */
export function semantic_index_to_json(
  index: import("../../../src/index_single_file/semantic_index").SemanticIndex
): SemanticIndexJSON {
  return {
    file_path: index.file_path,
    language: index.language,
    root_scope_id: index.root_scope_id,
    scopes: Object.fromEntries(index.scopes),
    functions: Object.fromEntries(index.functions),
    classes: Object.fromEntries(index.classes),
    variables: Object.fromEntries(index.variables),
    interfaces: Object.fromEntries(index.interfaces),
    enums: Object.fromEntries(index.enums),
    namespaces: Object.fromEntries(index.namespaces),
    types: Object.fromEntries(index.types),
    imported_symbols: Object.fromEntries(index.imported_symbols),
    references: [...index.references],
  };
}

/**
 * Deserializes a SemanticIndex from JSON format
 *
 * Converts plain objects back to ReadonlyMaps. This is the inverse
 * of semantic_index_to_json().
 *
 * @param json - The JSON object to deserialize
 * @returns A SemanticIndex object
 */
export function json_to_semantic_index(
  json: SemanticIndexJSON
): import("../../../src/index_single_file/semantic_index").SemanticIndex {
  return {
    file_path: json.file_path as FilePath,
    language: json.language as Language,
    root_scope_id: json.root_scope_id as ScopeId,
    scopes: new Map(Object.entries(json.scopes)) as ReadonlyMap<
      ScopeId,
      LexicalScope
    >,
    functions: new Map(Object.entries(json.functions)) as ReadonlyMap<
      SymbolId,
      FunctionDefinition
    >,
    classes: new Map(Object.entries(json.classes)) as ReadonlyMap<
      SymbolId,
      ClassDefinition
    >,
    variables: new Map(Object.entries(json.variables)) as ReadonlyMap<
      SymbolId,
      VariableDefinition
    >,
    interfaces: new Map(Object.entries(json.interfaces)) as ReadonlyMap<
      SymbolId,
      InterfaceDefinition
    >,
    enums: new Map(Object.entries(json.enums)) as ReadonlyMap<
      SymbolId,
      EnumDefinition
    >,
    namespaces: new Map(Object.entries(json.namespaces)) as ReadonlyMap<
      SymbolId,
      NamespaceDefinition
    >,
    types: new Map(Object.entries(json.types)) as ReadonlyMap<
      SymbolId,
      TypeAliasDefinition
    >,
    imported_symbols: new Map(
      Object.entries(json.imported_symbols)
    ) as ReadonlyMap<SymbolId, ImportDefinition>,
    references: json.references as readonly SymbolReference[],
  };
}

/**
 * Serializes a SemanticIndex to formatted JSON string
 *
 * Uses 2-space indentation for readable diffs and manual inspection.
 *
 * @param index - The SemanticIndex to serialize
 * @returns Formatted JSON string
 */
export function semantic_index_to_json_string(
  index: import("../../../src/index_single_file/semantic_index").SemanticIndex
): string {
  return JSON.stringify(semantic_index_to_json(index), null, 2);
}

/**
 * Deserializes a SemanticIndex from JSON string
 *
 * This is the inverse of semantic_index_to_json_string().
 *
 * @param json_string - The JSON string to deserialize
 * @returns A SemanticIndex object
 */
export function json_string_to_semantic_index(
  json_string: string
): import("../../../src/index_single_file/semantic_index").SemanticIndex {
  return json_to_semantic_index(JSON.parse(json_string));
}

/**
 * Writes a SemanticIndex to a JSON fixture file
 *
 * The file is written with 2-space indentation and a trailing newline
 * for clean git diffs.
 *
 * @param index - The SemanticIndex to write
 * @param output_path - Absolute path to the output JSON file
 */
export function write_semantic_index_fixture(
  index: import("../../../src/index_single_file/semantic_index").SemanticIndex,
  output_path: string
): void {
  const json_string = semantic_index_to_json_string(index);
  fs.writeFileSync(output_path, json_string + "\n", "utf-8");
}

/**
 * Loads a SemanticIndex from a JSON fixture file
 *
 * @param fixture_path - Absolute path to the JSON fixture file
 * @returns The deserialized SemanticIndex
 */
export function load_semantic_index_fixture(
  fixture_path: string
): import("../../../src/index_single_file/semantic_index").SemanticIndex {
  const json_string = fs.readFileSync(fixture_path, "utf-8");
  return json_string_to_semantic_index(json_string);
}
