/**
 * Failures of a call whose callee is defined where no indexed file can hold it.
 *
 * `len`, `console.log`, `os.getcwd()` and `render(...)` from a package the
 * project does not contain cannot resolve however well the resolver works. Each
 * is reported as the observation it is — the import's module named no indexed
 * file, or the language binds the name itself — so the residue left under
 * `name_not_in_scope` and `method_not_on_type` is the part a resolver change can
 * reach.
 */

import type {
  FilePath,
  ImportDefinition,
  Language,
  ResolutionFailure,
  ResolutionFailureStage,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { is_language_global } from "@ariadnejs/types";
import type { ImportGraph } from "../import_resolution/import_graph";
import { collect_hoisted_imports } from "../name_resolution";
import type { ResolutionRegistry } from "../resolution_registry";
import type { DefinitionRegistry } from "../registries/definition";
import type { ScopeRegistry } from "../registries/scope";

export interface OutsideCorpusContext {
  readonly scopes: ScopeRegistry;
  readonly definitions: DefinitionRegistry;
  readonly resolutions: ResolutionRegistry;
  readonly imports: ImportGraph;
  readonly languages: ReadonlyMap<FilePath, Language>;
}

/**
 * The file `import_def`'s module resolved to, when the project indexed it.
 *
 * `ImportGraph` records the path every module specifier points at — `os.py` for
 * `import os`, the bare specifier `fs` for `import * as fs from "fs"` — whether
 * or not any indexed file lies there, because a file indexed later must
 * re-resolve the import. Only an indexed file can answer a lookup.
 */
export function indexed_import_file(
  import_def: ImportDefinition,
  context: Pick<OutsideCorpusContext, "imports" | "languages">
): FilePath | null {
  const file = context.imports.get_resolved_import_path(import_def.symbol_id);
  return file !== undefined && context.languages.has(file) ? file : null;
}

function names_no_indexed_file(
  import_def: ImportDefinition,
  context: Pick<OutsideCorpusContext, "imports" | "languages">
): boolean {
  if (indexed_import_file(import_def, context) !== null) {
    return false;
  }
  const submodule = context.imports.get_submodule_import_path(import_def.symbol_id);
  return submodule === undefined || !context.languages.has(submodule);
}

export function import_unresolved_failure(
  import_def: ImportDefinition,
  stage: ResolutionFailureStage,
  partial_info: Pick<ResolutionFailure["partial_info"], "resolved_receiver_type" | "last_known_scope">
): ResolutionFailure {
  return {
    stage,
    reason: "import_unresolved",
    partial_info: { ...partial_info, import_specifier: import_def.import_path },
  };
}

/**
 * The import a receiver hop stands on, when its module names no indexed file —
 * `os` in `os.path.dirname(p)`, where the member `path` is absent only because
 * the module is.
 */
export function unindexed_import_receiver_failure(
  receiver_type: SymbolId,
  context: OutsideCorpusContext
): ResolutionFailure | null {
  const def = context.definitions.get(receiver_type);
  if (def?.kind !== "import" || def.import_kind === "wildcard") {
    return null;
  }
  return names_no_indexed_file(def, context)
    ? import_unresolved_failure(def, "import_resolution", { resolved_receiver_type: receiver_type })
    : null;
}

function language_of_scope(
  scope_id: ScopeId,
  context: Pick<OutsideCorpusContext, "scopes" | "languages">
): Language | undefined {
  const file = context.scopes.get_scope(scope_id)?.location.file_path;
  return file === undefined ? undefined : context.languages.get(file);
}

/**
 * The import statement binding `name` in the scope chain from `scope_id`, or
 * null. The nearest scope binding the name decides, as in name resolution; a
 * Python import under `if`/`try` binds in the enclosing function or module.
 */
function find_import_binding(
  name: SymbolName,
  scope_id: ScopeId,
  context: OutsideCorpusContext
): ImportDefinition | null {
  const language = language_of_scope(scope_id, context);
  for (
    let scope = context.scopes.get_scope(scope_id);
    scope;
    scope = scope.parent_id ? context.scopes.get_scope(scope.parent_id) : undefined
  ) {
    const candidates = [
      ...context.imports.get_scope_imports(scope.id),
      ...(language === "python" && scope.type !== "block"
        ? collect_hoisted_imports(scope.id, context)
        : []),
    ];
    const binding = candidates.find(
      (candidate) => candidate.import_kind !== "wildcard" && candidate.name === name
    );
    if (binding) {
      return binding;
    }
  }
  return null;
}

/**
 * Why `name`, read in `scope_id`, binds nothing a call can resolve through.
 *
 * An import whose module names no indexed file is the first answer, because an
 * import the author wrote outranks a word the language also binds. A name the
 * language binds itself is the second. Anything else is an identifier no scope
 * or import binds.
 */
export function unbound_name_failure(
  name: SymbolName,
  scope_id: ScopeId,
  stage: ResolutionFailureStage,
  context: OutsideCorpusContext
): ResolutionFailure {
  const bound = context.resolutions.resolve(scope_id, name);
  const binding = bound
    ? context.definitions.get(bound)
    : find_import_binding(name, scope_id, context);
  if (binding?.kind === "import" && names_no_indexed_file(binding, context)) {
    return import_unresolved_failure(binding, stage, { last_known_scope: scope_id });
  }

  const language = language_of_scope(scope_id, context);
  if (!bound && language !== undefined && is_language_global(language, name)) {
    return {
      stage,
      reason: "callee_is_a_language_global",
      partial_info: { last_known_scope: scope_id },
    };
  }

  return {
    stage,
    reason: "name_not_in_scope",
    partial_info: { last_known_scope: scope_id },
  };
}
