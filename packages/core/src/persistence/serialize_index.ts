/**
 * SemanticIndex JSON serialization and deserialization.
 *
 * Maps are serialized as [key, value][] entry arrays for deterministic round-trips.
 * Branded string types (SymbolId, ScopeId, etc.) serialize as plain strings
 * and are restored via type assertions at the deserialization boundary.
 */

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
import type { SemanticIndex } from "../index_single_file/index_single_file";

// ============================================================================
// Map/Set serialization utilities
// ============================================================================

function serialize_map<K, V>(map: ReadonlyMap<K, V>): [K, V][] {
  return Array.from(map.entries());
}

function deserialize_map<K, V>(entries: [K, V][]): ReadonlyMap<K, V> {
  return new Map(entries) as ReadonlyMap<K, V>;
}

// ============================================================================
// SemanticIndex serialization
// ============================================================================

/** Serialize a SemanticIndex to a JSON string. */
export function serialize_semantic_index(index: SemanticIndex): string {
  return JSON.stringify({
    file_path: index.file_path,
    language: index.language,
    root_scope_id: index.root_scope_id,
    scopes: serialize_map(index.scopes),
    functions: serialize_map(index.functions),
    classes: serialize_map(index.classes),
    variables: serialize_map(index.variables),
    interfaces: serialize_map(index.interfaces),
    enums: serialize_map(index.enums),
    namespaces: serialize_map(index.namespaces),
    types: serialize_map(index.types),
    imported_symbols: serialize_map(index.imported_symbols),
    references: index.references,
  });
}

/** Deserialize a SemanticIndex from a JSON string or pre-parsed object. */
export function deserialize_semantic_index(
  input: string | Record<string, unknown>,
): SemanticIndex {
  const p = typeof input === "string" ? JSON.parse(input) : input;
  return {
    file_path: p.file_path as FilePath,
    language: p.language as Language,
    root_scope_id: p.root_scope_id as ScopeId,
    scopes: deserialize_map<ScopeId, LexicalScope>(p.scopes),
    functions: deserialize_map<SymbolId, FunctionDefinition>(p.functions),
    classes: deserialize_map<SymbolId, ClassDefinition>(p.classes),
    variables: deserialize_map<SymbolId, VariableDefinition>(p.variables),
    interfaces: deserialize_map<SymbolId, InterfaceDefinition>(p.interfaces),
    enums: deserialize_map<SymbolId, EnumDefinition>(p.enums),
    namespaces: deserialize_map<SymbolId, NamespaceDefinition>(p.namespaces),
    types: deserialize_map<SymbolId, TypeAliasDefinition>(p.types),
    imported_symbols: deserialize_map<SymbolId, ImportDefinition>(p.imported_symbols),
    references: p.references as readonly SymbolReference[],
  };
}

/**
 * Structural spot-check for deserialized SemanticIndex shape.
 * Catches common corruption modes without deep field validation.
 */
export function validate_semantic_index_shape(parsed: unknown): boolean {
  if (parsed === null || typeof parsed !== "object") return false;
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.file_path !== "string") return false;
  if (typeof obj.language !== "string") return false;
  if (typeof obj.root_scope_id !== "string") return false;

  for (const field of [
    "scopes",
    "functions",
    "classes",
    "variables",
    "interfaces",
    "enums",
    "namespaces",
    "types",
    "imported_symbols",
  ]) {
    if (!Array.isArray(obj[field])) return false;
  }

  if (!Array.isArray(obj.references)) return false;

  return true;
}
