import { describe, it, expect } from "vitest";
import { class_symbol, namespace_symbol } from "@ariadnejs/types";
import type {
  ClassDefinition,
  FilePath,
  ImportDefinition,
  Location,
  ModulePath,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { DefinitionRegistry } from "./registries/definition";
import { ResolutionRegistry } from "./resolution_registry";
import { set_test_resolutions } from "./resolve_references.test";
import { make_export_chain_context, make_type_resolution_context } from "./resolution_test_helpers";
import { parse_type_annotation } from "./type_preprocessing";
import { lookup_annotation, lookup_annotation_arguments, lookup_type_name } from "./type_annotation_lookup";

const FILE = "main.ts" as FilePath;
const SCOPE = "module:0:0" as ScopeId;

function make_location(file_path: FilePath, start_line: number): Location {
  return {
    file_path,
    start_line,
    start_column: 0,
    end_line: start_line + 1,
    end_column: 1,
  };
}

function make_class(name: string, line: number): { id: SymbolId; def: ClassDefinition } {
  const location = make_location(FILE, line);
  const id = class_symbol(name as SymbolName, location);
  return {
    id,
    def: {
      kind: "class",
      symbol_id: id,
      name: name as SymbolName,
      location,
      defining_scope_id: SCOPE,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [],
    },
  };
}

/**
 * The registries and context a head is looked up through, holding the named
 * classes in one module scope. The heads under test resolve in lexical scope, so
 * the seeded scope binds every name the test means.
 */
function load(class_names: readonly string[]) {
  const definitions = new DefinitionRegistry();
  const resolutions = new ResolutionRegistry();
  const bindings = new Map<SymbolName, SymbolId>();
  const built = class_names.map((name, index) => make_class(name, index + 1));

  definitions.update_file(
    FILE,
    built.map((entry) => entry.def)
  );
  for (const entry of built) {
    bindings.set(entry.def.name, entry.id);
  }
  set_test_resolutions(resolutions, SCOPE, bindings);

  const { exports, modules } = make_export_chain_context();
  const context = make_type_resolution_context(
    resolutions,
    exports,
    new Map([[FILE, "typescript"]]),
    modules
  );
  const id_of = (name: string): SymbolId => {
    const found = built.find((entry) => entry.def.name === (name as SymbolName));
    if (!found) {
      throw new Error(`no class named ${name}`);
    }
    return found.id;
  };
  return { definitions, context, id_of };
}

describe("the definition a type name names", () => {
  it("resolves a bare name in lexical scope", () => {
    const { definitions, context, id_of } = load(["Router"]);

    expect(lookup_type_name(SCOPE, "Router" as SymbolName, FILE, definitions, context)).toEqual(
      id_of("Router")
    );
  });

  it("resolves the head of a generic name, not its argument", () => {
    const { definitions, context, id_of } = load(["Provider", "Router"]);

    expect(
      lookup_type_name(SCOPE, "Provider<Router>" as SymbolName, FILE, definitions, context)
    ).toEqual(id_of("Provider"));
  });

  it("reads through the wrappers that do not change which members a receiver reaches", () => {
    const { definitions, context, id_of } = load(["Router"]);

    expect(
      lookup_type_name(SCOPE, "Router | null" as SymbolName, FILE, definitions, context)
    ).toEqual(id_of("Router"));
  });

  it("is nothing for a name the project does not hold", () => {
    const { definitions, context } = load(["Router"]);

    expect(lookup_type_name(SCOPE, "Elsewhere" as SymbolName, FILE, definitions, context)).toEqual(
      null
    );
  });

  it("is nothing for a language the context does not know the file's grammar for", () => {
    const { definitions, context } = load(["Router"]);
    const other = "other.ts" as FilePath;

    expect(lookup_type_name(SCOPE, "Router" as SymbolName, other, definitions, context)).toEqual(
      null
    );
  });
});

describe("a qualified head", () => {
  it("is nothing when its first segment names a class rather than a module", () => {
    // `models.User` must never be read as a member of a class called `models`:
    // a segment is followed only out of an import denoting a whole module.
    const { definitions, context } = load(["models", "User"]);
    const annotation = parse_type_annotation("models.User", "typescript");
    if (!annotation) {
      throw new Error("annotation did not parse");
    }

    expect(
      lookup_annotation(SCOPE, annotation, FILE, "typescript", definitions, context)
    ).toEqual(null);
  });

  it("is nothing when its first segment names an import with no module behind it", () => {
    const definitions = new DefinitionRegistry();
    const resolutions = new ResolutionRegistry();
    const location = make_location(FILE, 1);
    const import_id = namespace_symbol("models" as SymbolName, location);
    const import_def: ImportDefinition = {
      kind: "import",
      symbol_id: import_id,
      name: "models" as SymbolName,
      location,
      defining_scope_id: SCOPE,
      import_path: "./models" as ModulePath,
      import_kind: "namespace",
    };
    definitions.update_file(FILE, [import_def]);
    set_test_resolutions(
      resolutions,
      SCOPE,
      new Map<SymbolName, SymbolId>([["models" as SymbolName, import_id]])
    );
    const { exports, modules } = make_export_chain_context();
    const context = make_type_resolution_context(
      resolutions,
      exports,
      new Map([[FILE, "typescript"]]),
      modules
    );
    const annotation = parse_type_annotation("models.User", "typescript");
    if (!annotation) {
      throw new Error("annotation did not parse");
    }

    // The import resolves to no file here, so the descent stops rather than
    // falling back to a same-named binding in scope.
    expect(
      lookup_annotation(SCOPE, annotation, FILE, "typescript", definitions, context)
    ).toEqual(null);
  });
});

describe("the definitions an annotation's arguments name", () => {
  it("yields each argument in order", () => {
    const { definitions, context, id_of } = load(["Provider", "Router"]);
    const annotation = parse_type_annotation("Provider<Router>", "typescript");
    if (!annotation) {
      throw new Error("annotation did not parse");
    }

    expect(
      lookup_annotation_arguments(SCOPE, annotation, FILE, "typescript", definitions, context)
    ).toEqual([id_of("Router")]);
  });

  it("yields none at all when one position does not resolve, so no argument shifts", () => {
    const { definitions, context } = load(["Registry", "Router"]);
    const annotation = parse_type_annotation("Registry<Elsewhere, Router>", "typescript");
    if (!annotation) {
      throw new Error("annotation did not parse");
    }

    expect(
      lookup_annotation_arguments(SCOPE, annotation, FILE, "typescript", definitions, context)
    ).toEqual([]);
  });
});
