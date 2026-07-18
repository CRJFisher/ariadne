import type { FilePath, Language } from "./location";
import type { SymbolId } from "./symbol";
import type { ScopeId } from "./scopes";
import type { LexicalScope } from "./lexical_scope";
import type {
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  EnumDefinition,
  NamespaceDefinition,
  TypeAliasDefinition,
  ImportDefinition,
} from "./symbol_definitions";
import type { SymbolReference } from "./symbol_references";

/**
 * Semantic Index - Single-file analysis results
 * Import/Export union types are created during cross-file resolution in resolve_references/
 */
export interface SemanticIndex {
  readonly file_path: FilePath;
  readonly language: Language;
  readonly root_scope_id: ScopeId;

  /** Scope data */
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;

  /** Definitions */
  readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
  readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
  readonly variables: ReadonlyMap<SymbolId, VariableDefinition>;
  readonly interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  readonly enums: ReadonlyMap<SymbolId, EnumDefinition>;
  readonly namespaces: ReadonlyMap<SymbolId, NamespaceDefinition>;
  readonly types: ReadonlyMap<SymbolId, TypeAliasDefinition>;
  readonly imported_symbols: ReadonlyMap<SymbolId, ImportDefinition>;

  /** References */
  readonly references: readonly SymbolReference[];
}
