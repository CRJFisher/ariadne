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
import type { SemanticIndex } from "@ariadnejs/types";

function serialize_map<K, V>(map: ReadonlyMap<K, V>): [K, V][] {
  return Array.from(map.entries());
}

function deserialize_map<K, V>(entries: [K, V][]): ReadonlyMap<K, V> {
  return new Map(entries) as ReadonlyMap<K, V>;
}

/**
 * The JSON-ready shape of an index, before stringification. Exposed separately
 * so a cached index can be embedded in the stamp that validates it and the pair
 * written as one document, rather than stringified twice.
 */
export function to_serializable_semantic_index(
  index: SemanticIndex,
): Record<string, unknown> {
  return {
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
  };
}

/**
 * Parse a document with every repeated string in it restored to ONE instance.
 *
 * A freshly built index shares a symbol id between the map that keys it, the
 * definition that carries it and every reference that names it, and each of
 * those ids embeds the file's absolute path. `JSON.parse` hands back a separate
 * copy per occurrence, so a round trip nearly doubles what the index retains:
 * measured over 1,200 files of vscode's `src/` at f3fa55c3, the same corpus
 * retained 507.1 MB built directly and 971.3 MB round-tripped, and 460.7 MB
 * round-tripped through this parse, with no other difference between the arms.
 *
 * The table is per document, so it holds one file's strings rather than the
 * corpus's, and it is dropped with the parse.
 */
function share_repeated_strings(root: Record<string, unknown>): void {
  const seen = new Map<string, string>();
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const value: unknown = node[i];
        if (typeof value === "string") {
          const shared = seen.get(value);
          if (shared === undefined) seen.set(value, value);
          else node[i] = shared;
        } else if (value !== null && typeof value === "object") {
          pending.push(value);
        }
      }
      continue;
    }
    if (node === null || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value: unknown = record[key];
      if (typeof value === "string") {
        const shared = seen.get(value);
        if (shared === undefined) seen.set(value, value);
        else record[key] = shared;
      } else if (value !== null && typeof value === "object") {
        pending.push(value);
      }
    }
  }
}

function parse_sharing_repeated_strings(json: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = JSON.parse(json);
  share_repeated_strings(parsed);
  return parsed;
}

export function deserialize_semantic_index(
  input: string | Record<string, unknown>,
): SemanticIndex {
  const p: Record<string, unknown> =
    typeof input === "string" ? parse_sharing_repeated_strings(input) : input;
  return {
    file_path: p.file_path as FilePath,
    language: p.language as Language,
    root_scope_id: p.root_scope_id as ScopeId,
    scopes: deserialize_map<ScopeId, LexicalScope>(p.scopes as [ScopeId, LexicalScope][]),
    functions: deserialize_map<SymbolId, FunctionDefinition>(p.functions as [SymbolId, FunctionDefinition][]),
    classes: deserialize_map<SymbolId, ClassDefinition>(p.classes as [SymbolId, ClassDefinition][]),
    variables: deserialize_map<SymbolId, VariableDefinition>(p.variables as [SymbolId, VariableDefinition][]),
    interfaces: deserialize_map<SymbolId, InterfaceDefinition>(p.interfaces as [SymbolId, InterfaceDefinition][]),
    enums: deserialize_map<SymbolId, EnumDefinition>(p.enums as [SymbolId, EnumDefinition][]),
    namespaces: deserialize_map<SymbolId, NamespaceDefinition>(p.namespaces as [SymbolId, NamespaceDefinition][]),
    types: deserialize_map<SymbolId, TypeAliasDefinition>(p.types as [SymbolId, TypeAliasDefinition][]),
    imported_symbols: deserialize_map<SymbolId, ImportDefinition>(p.imported_symbols as [SymbolId, ImportDefinition][]),
    references: p.references as readonly SymbolReference[],
  };
}

/**
 * Guards the cache-load path: a corrupt or truncated cache file must be
 * rejected before deserialization treats its fields as valid Maps. Checks
 * shape only, not field contents, since callers rebuild on any failure.
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
