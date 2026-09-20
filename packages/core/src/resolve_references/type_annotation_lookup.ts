/**
 * The definition a type annotation names: the single route from a parsed
 * annotation to a `SymbolId`.
 *
 * Every annotation the pipeline reads arrives here — a value's declared type, a
 * callable's declared return, a constructor's callee chain, a heritage clause's
 * parent name, a type parameter's bound. Parsing the text is
 * `type_preprocessing/`'s and is pure; looking the parsed head up needs name
 * resolution, the exports and the import graph, which is why this is a leaf of
 * `resolve_references` rather than part of that folder.
 *
 * A head is a name chain, and which of three routes it takes is the language's
 * business: a bare name resolves in lexical scope, an inline import type names
 * its module outright, a Rust `::` path goes to the Rust path resolver, and any
 * other qualified chain descends one module per segment. Descending is the rule
 * that keeps `models.User` from ever being read as a member of a class called
 * `models` that happens to be in scope.
 */

import type { FilePath, Language, ScopeId, SymbolId, SymbolName } from "@ariadnejs/types";
import type { DefinitionRegistry } from "./registries/definition";
import type { ExportRegistry } from "./registries/export";
import type { ResolutionRegistry } from "./resolution_registry";
import { parse_type_annotation, type ParsedTypeAnnotation } from "./type_preprocessing";
import { resolve_module_member } from "./module_member_lookup";
import { resolve_module_path, type ModuleResolutionContext } from "./import_resolution";
import type { ImportGraph } from "./import_resolution/import_graph";

/**
 * @language rust
 * Resolves `module_path::terminal` to the type that path names. Rust's `::`
 * paths have one resolver, which lives in call resolution — a layer no registry
 * imports — so the project hands it in.
 */
export type RustTypePathResolver = (
  module_path: readonly SymbolName[],
  terminal: SymbolName,
  scope_id: ScopeId,
  file_id: FilePath
) => SymbolId | null;

/**
 * What a head is looked up through, narrower than the type-resolution context
 * the caller holds: the lookup reads names, exports and modules, and says
 * nothing about the types a file declares or what `self` names.
 */
export interface AnnotationLookupContext {
  readonly resolutions: ResolutionRegistry;
  readonly exports: ExportRegistry;
  readonly imports: ImportGraph;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly modules: ModuleResolutionContext;
  readonly resolve_rust_type_path: RustTypePathResolver;
}

/**
 * The definition a type name written in `file_id` names, looked up from
 * `scope_id`: the text is parsed under the file's language grammar and its head
 * resolved exactly as an annotation's is, so `o.TypeVisitor`,
 * `compiler.DDLCompiler` and `Base<T>` all name their terminal definition.
 */
export function lookup_type_name(
  scope_id: ScopeId,
  type_name: SymbolName,
  file_id: FilePath,
  definitions: DefinitionRegistry,
  context: AnnotationLookupContext
): SymbolId | null {
  const language = context.languages.get(file_id);
  const annotation = language ? parse_type_annotation(type_name, language) : null;
  return annotation && language
    ? lookup_annotation(scope_id, annotation, file_id, language, definitions, context)
    : null;
}

/**
 * The definition a parsed annotation's head names, looked up from `scope_id` in
 * `file_id`.
 */
export function lookup_annotation(
  scope_id: ScopeId,
  annotation: ParsedTypeAnnotation,
  file_id: FilePath,
  language: Language,
  definitions: DefinitionRegistry,
  context: AnnotationLookupContext
): SymbolId | null {
  return lookup_type_head(
    scope_id,
    annotation.head,
    annotation.module_specifier,
    file_id,
    language,
    definitions,
    context
  );
}

/**
 * The definitions an annotation's type arguments name, in order — `Vec<Enc>`
 * yields `[Enc]`. All or nothing: a position that does not resolve would shift
 * every later argument onto the wrong parameter, so any miss yields no
 * arguments at all.
 */
export function lookup_annotation_arguments(
  scope_id: ScopeId,
  annotation: ParsedTypeAnnotation,
  file_id: FilePath,
  language: Language,
  definitions: DefinitionRegistry,
  context: AnnotationLookupContext
): readonly SymbolId[] {
  const argument_ids: SymbolId[] = [];
  for (const argument of annotation.arguments) {
    const argument_id = lookup_annotation(
      scope_id,
      argument,
      file_id,
      language,
      definitions,
      context
    );
    if (!argument_id) {
      return [];
    }
    argument_ids.push(argument_id);
  }
  return argument_ids;
}

/**
 * Resolve a type's name chain — an annotation head or a constructor callee
 * chain — to the definition it names.
 *
 * - A bare name resolves in lexical scope.
 * - An inline import type (`import("./a").X`) names its module outright, so the
 *   chain starts among that module's members. Nothing else ties the file to that
 *   module, so the read is recorded as its dependency.
 * - A Rust `::` path goes to the Rust path resolver.
 * - Any other qualified chain (`vfs.FileSystem`, `models.User`) starts from its
 *   first segment in lexical scope and descends one module per segment.
 */
export function lookup_type_head(
  scope_id: ScopeId,
  head: readonly SymbolName[],
  module_specifier: string | undefined,
  file_id: FilePath,
  language: Language,
  definitions: DefinitionRegistry,
  context: AnnotationLookupContext
): SymbolId | null {
  if (module_specifier !== undefined) {
    const module_file = resolve_module_path(module_specifier, file_id, language, context.modules);
    context.imports.record_module_path_read(file_id, module_file);
    const first = resolve_module_member(
      module_file,
      head[0],
      "named",
      context.exports,
      definitions,
      context.languages,
      context.modules
    );
    return first ? descend_modules(first, head.slice(1), definitions, context) : null;
  }

  // @language rust
  if (language === "rust" && head.length > 1) {
    return context.resolve_rust_type_path(
      head.slice(0, -1),
      head[head.length - 1],
      scope_id,
      file_id
    );
  }

  const first = context.resolutions.resolve(scope_id, head[0]);
  return first ? descend_modules(first, head.slice(1), definitions, context) : null;
}

/**
 * Follow `segments` from `start`, each one a member of the module the previous
 * segment names. A segment is only followed out of an import that denotes a
 * whole module — a namespace import, or a named import that names a submodule
 * file (`from django.db import models`) — so a qualified name can never be read
 * as a member of a same-named class or value in scope.
 */
function descend_modules(
  start: SymbolId,
  segments: readonly SymbolName[],
  definitions: DefinitionRegistry,
  context: AnnotationLookupContext
): SymbolId | null {
  let current = start;
  for (const segment of segments) {
    const module_file = module_file_of(current, definitions, context);
    if (!module_file) {
      return null;
    }
    const member = resolve_module_member(
      module_file,
      segment,
      "namespace",
      context.exports,
      definitions,
      context.languages,
      context.modules
    );
    if (!member) {
      return null;
    }
    current = member;
  }
  return current;
}

/** The module file an import symbol denotes as a whole, or null when it names an item. */
function module_file_of(
  symbol_id: SymbolId,
  definitions: DefinitionRegistry,
  context: AnnotationLookupContext
): FilePath | null {
  const definition = definitions.get(symbol_id);
  if (definition?.kind !== "import") {
    return null;
  }
  if (definition.import_kind === "namespace") {
    return context.imports.get_resolved_import_path(symbol_id) ?? null;
  }
  if (definition.import_kind === "named") {
    return context.imports.get_submodule_import_path(symbol_id) ?? null;
  }
  return null;
}
