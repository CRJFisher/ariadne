import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "../project/project";
import {
  declared_annotation,
  resolve_annotation_in_environment,
} from "./type_parameter_environment";
import { parse_type_annotation, type TypeParameterBinding } from "./type_preprocessing";
import type {
  AnyDefinition,
  FunctionDefinition,
  ScopeId,
  SemanticIndex,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * One generic declaration of each shape the environment reads, loaded as a
 * project so the definitions and name resolution an argument's type is read
 * through are the real ones.
 */
const SOURCE = `
class Router {}
interface Visitor {
  visit(): void;
}
interface Type<T> {
  readonly name: string;
}

function create<T>(token: Type<T>): T {
  return null as unknown as T;
}

function first_of<T>(items: Array<T>): T {
  return items[0];
}

function walk<V extends Visitor>(visitor: V): V {
  return visitor;
}

function make<T extends Visitor>(token: Type<T>): T {
  return null as unknown as T;
}

function call_site(routers: Array<Router>, names: Array<string>) {
  return [first_of(routers), first_of(names)];
}

const held: Array<Router> = [];
let mutable: Router = new Router();

class Holder {
  owned: Array<Router> = [];
}
`;

interface Loaded {
  readonly project: Project;
  readonly index: SemanticIndex;
}

async function load(): Promise<Loaded> {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "type-parameter-env-")));
  temp_dirs.push(dir);
  const file = path.join(dir, "main.ts") as SemanticIndex["file_path"];
  fs.writeFileSync(file, SOURCE);
  const project = new Project();
  await project.initialize(dir as SemanticIndex["file_path"]);
  project.update_file(file, SOURCE);
  const index = project.get_index_single_file(file);
  if (!index) {
    throw new Error("the project did not index its only file");
  }
  return { project, index };
}

/** The registries the environment reads an argument's type through. */
function context_of(project: Project) {
  return {
    definitions: project.definitions,
    resolutions: project.resolutions,
    languages: project.get_languages(),
  };
}

function function_named(index: SemanticIndex, name: string): FunctionDefinition {
  const def = [...index.functions.values()].find((fn) => fn.name === (name as SymbolName));
  if (!def) {
    throw new Error(`no function named ${name}`);
  }
  return def;
}

/** The SymbolId of the class or interface `name`, which a bound annotation must resolve to. */
function type_named(index: SemanticIndex, name: string): SymbolId {
  const def = [...index.classes.values(), ...index.interfaces.values()].find(
    (candidate) => candidate.name === (name as SymbolName)
  );
  if (!def) {
    throw new Error(`no type named ${name}`);
  }
  return def.symbol_id;
}

/** The parameter `name` of `call_site`, standing for an argument at a call in its body. */
function argument_named(index: SemanticIndex, name: string): AnyDefinition {
  const def = function_named(index, "call_site").signature.parameters.find(
    (candidate) => candidate.name === (name as SymbolName)
  );
  if (!def) {
    throw new Error(`no parameter named ${name}`);
  }
  return def;
}

/** The local binding `name`, whose declared kind is the `const`/`let` it was written with. */
function binding_named(index: SemanticIndex, name: string): AnyDefinition {
  const def = [...index.variables.values()].find(
    (candidate) => candidate.name === (name as SymbolName)
  );
  if (!def) {
    throw new Error(`no binding named ${name}`);
  }
  return def;
}

/** The field `name` of class `Holder`. */
function property_named(index: SemanticIndex, name: string): AnyDefinition {
  const holder = [...index.classes.values()].find(
    (candidate) => candidate.name === ("Holder" as SymbolName)
  );
  const def = holder?.properties.find((candidate) => candidate.name === (name as SymbolName));
  if (!def) {
    throw new Error(`no property named ${name}`);
  }
  return def;
}

/** The scope the calls in `call_site`'s body are written in, where its parameters resolve. */
function call_scope(index: SemanticIndex): ScopeId {
  return function_named(index, "call_site").body_scope_id;
}

/** The parsed annotation a test substitutes through the environment it built. */
function annotation(text: string) {
  const parsed = parse_type_annotation(text as SymbolName, "typescript");
  if (!parsed) {
    throw new Error(`unparseable annotation ${text}`);
  }
  return parsed;
}

function call_evidence(
  callee: FunctionDefinition,
  call_arguments: readonly (SymbolName | null)[] | null,
  scope_id: ScopeId
) {
  return {
    parameters: callee.signature.parameters,
    call_arguments,
    declaring_language: "typescript" as const,
    scope_id,
  };
}

describe("the call's arguments", () => {
  it("binds a type parameter to the type a token argument names", async () => {
    const { project, index } = await load();
    const create = function_named(index, "create");

    const resolved = resolve_annotation_in_environment(
      annotation("T"),
      new Set(["T" as SymbolName]),
      { call: call_evidence(create, ["Router" as SymbolName], index.root_scope_id) },
      context_of(project)
    );

    expect(resolved).toEqual(type_named(index, "Router"));
  });

  it("binds a type parameter from the annotation a value argument declares", async () => {
    const { project, index } = await load();
    const first_of = function_named(index, "first_of");

    const resolved = resolve_annotation_in_environment(
      annotation("T"),
      new Set(["T" as SymbolName]),
      { call: call_evidence(first_of, ["routers" as SymbolName], call_scope(index)) },
      context_of(project)
    );

    expect(resolved).toEqual(type_named(index, "Router"));
  });

  it("resolves nothing when the argument binds the parameter to a name no type answers", async () => {
    const { project, index } = await load();
    const first_of = function_named(index, "first_of");

    const resolved = resolve_annotation_in_environment(
      annotation("T"),
      new Set(["T" as SymbolName]),
      { call: call_evidence(first_of, ["names" as SymbolName], call_scope(index)) },
      context_of(project)
    );

    expect(resolved).toEqual(null);
  });

  it("resolves nothing when the call passes no arguments at all", async () => {
    const { project, index } = await load();
    const create = function_named(index, "create");

    const resolved = resolve_annotation_in_environment(
      annotation("T"),
      new Set(["T" as SymbolName]),
      { call: call_evidence(create, null, index.root_scope_id) },
      context_of(project)
    );

    expect(resolved).toEqual(null);
  });
});

describe("the declared bounds", () => {
  it("binds a type parameter to its bound when no call site says more", async () => {
    const { project, index } = await load();
    const walk = function_named(index, "walk");

    const resolved = resolve_annotation_in_environment(
      annotation("V"),
      new Set(["V" as SymbolName]),
      { bounds: { parameters: walk.generics ?? [], scope_id: index.root_scope_id } },
      context_of(project)
    );

    expect(resolved).toEqual(type_named(index, "Visitor"));
  });

  it("yields to what the call's arguments bound, a bound being the weaker evidence", async () => {
    const { project, index } = await load();
    const make = function_named(index, "make");

    const resolved = resolve_annotation_in_environment(
      annotation("T"),
      new Set(["T" as SymbolName]),
      {
        call: call_evidence(make, ["Router" as SymbolName], index.root_scope_id),
        bounds: { parameters: make.generics ?? [], scope_id: index.root_scope_id },
      },
      context_of(project)
    );

    expect(resolved).toEqual(type_named(index, "Router"));
  });
});

describe("the receiver's declared instantiation", () => {
  it("binds what the call's arguments left unbound", async () => {
    const { project, index } = await load();
    const create = function_named(index, "create");

    const resolved = resolve_annotation_in_environment(
      annotation("T"),
      new Set(["T" as SymbolName]),
      {
        call: call_evidence(create, null, index.root_scope_id),
        bind_receiver_instantiation: (bindings: Map<SymbolName, TypeParameterBinding>) => {
          bindings.set("T" as SymbolName, {
            annotation: annotation("Router"),
            scope_id: index.root_scope_id,
          });
        },
      },
      context_of(project)
    );

    expect(resolved).toEqual(type_named(index, "Router"));
  });

  it("runs after the call's arguments, so a first-wins binder leaves them standing", async () => {
    const { project, index } = await load();
    const create = function_named(index, "create");

    const resolved = resolve_annotation_in_environment(
      annotation("T"),
      new Set(["T" as SymbolName]),
      {
        call: call_evidence(create, ["Router" as SymbolName], index.root_scope_id),
        bind_receiver_instantiation: (bindings: Map<SymbolName, TypeParameterBinding>) => {
          if (!bindings.has("T" as SymbolName)) {
            bindings.set("T" as SymbolName, {
              annotation: annotation("Visitor"),
              scope_id: index.root_scope_id,
            });
          }
        },
      },
      context_of(project)
    );

    expect(resolved).toEqual(type_named(index, "Router"));
  });
});

describe("the annotation a value binding declares", () => {
  const ARRAY_OF_ROUTER = {
    head: ["Array"],
    arguments: [{ head: ["Router"], arguments: [] }],
  };

  it("is parsed under its own file's grammar", async () => {
    const { project, index } = await load();

    expect(declared_annotation(argument_named(index, "routers"), context_of(project))).toEqual(
      ARRAY_OF_ROUTER
    );
  });

  it("is read from a constant, which declares its annotation as a parameter does", async () => {
    const { project, index } = await load();

    expect(declared_annotation(binding_named(index, "held"), context_of(project))).toEqual(
      ARRAY_OF_ROUTER
    );
  });

  it("is read from a mutable variable", async () => {
    const { project, index } = await load();

    expect(declared_annotation(binding_named(index, "mutable"), context_of(project))).toEqual({
      head: ["Router"],
      arguments: [],
    });
  });

  it("is read from a property", async () => {
    const { project, index } = await load();

    expect(declared_annotation(property_named(index, "owned"), context_of(project))).toEqual(
      ARRAY_OF_ROUTER
    );
  });

  it("is nothing for a definition that declares no value", async () => {
    const { project, index } = await load();
    const router = [...index.classes.values()].find(
      (def) => def.name === ("Router" as SymbolName)
    );
    if (!router) {
      throw new Error("no class named Router");
    }

    expect(declared_annotation(router, context_of(project))).toEqual(null);
  });
});
