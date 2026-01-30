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
 * - File paths are stored as relative paths (relative to fixtures directory)
 *   to support git worktrees and portability across machines
 */

import fs from "fs";
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
 * Placeholder used in JSON fixtures to represent paths relative to fixtures directory.
 * When writing: absolute paths are converted to <fixtures>/relative/path
 * When loading: <fixtures>/relative/path is converted back to absolute paths
 */
const FIXTURES_PLACEHOLDER = "<fixtures>/";

/**
 * Get the fixtures directory path
 */
function get_fixtures_dir(): string {
  return __dirname;
}

/**
 * Convert absolute paths to relative paths with placeholder
 *
 * Replaces absolute paths under the fixtures directory with <fixtures>/relative/path
 */
function absolute_to_relative_paths(json_string: string): string {
  const fixtures_dir = get_fixtures_dir();
  // Escape special regex characters in the path and replace
  const escaped_path = fixtures_dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped_path + "/", "g");
  return json_string.replace(regex, FIXTURES_PLACEHOLDER);
}

/**
 * Convert relative paths with placeholder back to absolute paths
 *
 * Replaces <fixtures>/relative/path with absolute paths for the current machine
 */
function relative_to_absolute_paths(json_string: string): string {
  const fixtures_dir = get_fixtures_dir();
  return json_string.replaceAll(FIXTURES_PLACEHOLDER, fixtures_dir + "/");
}

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
export function index_single_file_to_json(
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
 * of index_single_file_to_json().
 *
 * @param json - The JSON object to deserialize
 * @returns A SemanticIndex object
 */
export function json_to_index_single_file(
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
export function index_single_file_to_json_string(
  index: import("../../../src/index_single_file/semantic_index").SemanticIndex
): string {
  return JSON.stringify(index_single_file_to_json(index), null, 2);
}

/**
 * Deserializes a SemanticIndex from JSON string
 *
 * This is the inverse of index_single_file_to_json_string().
 *
 * @param json_string - The JSON string to deserialize
 * @returns A SemanticIndex object
 */
export function json_string_to_index_single_file(
  json_string: string
): import("../../../src/index_single_file/semantic_index").SemanticIndex {
  return json_to_index_single_file(JSON.parse(json_string));
}

/**
 * Writes a SemanticIndex to a JSON fixture file
 *
 * The file is written with 2-space indentation and a trailing newline
 * for clean git diffs. Absolute paths are converted to relative paths
 * using the <fixtures>/ placeholder for portability.
 *
 * @param index - The SemanticIndex to write
 * @param output_path - Absolute path to the output JSON file
 */
export function write_index_single_file_fixture(
  index: import("../../../src/index_single_file/semantic_index").SemanticIndex,
  output_path: string
): void {
  const json_string = index_single_file_to_json_string(index);
  const relative_json_string = absolute_to_relative_paths(json_string);
  fs.writeFileSync(output_path, relative_json_string + "\n", "utf-8");
}

/**
 * Loads a SemanticIndex from a JSON fixture file
 *
 * Relative paths using the <fixtures>/ placeholder are converted back
 * to absolute paths for the current machine/worktree.
 *
 * @param fixture_path - Absolute path to the JSON fixture file
 * @returns The deserialized SemanticIndex
 */
export function load_index_single_file_fixture(
  fixture_path: string
): import("../../../src/index_single_file/semantic_index").SemanticIndex {
  const json_string = fs.readFileSync(fixture_path, "utf-8");
  const absolute_json_string = relative_to_absolute_paths(json_string);
  return json_string_to_index_single_file(absolute_json_string);
}
