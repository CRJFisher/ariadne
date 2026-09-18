import { describe, it, expect, beforeEach } from "vitest";
import {
  infer_structural_subtypes,
  infer_conformance_to_pending_interfaces,
} from "./structural_conformance";
import { DefinitionRegistry } from "../registries/definition";
import type {
  AnyDefinition,
  ClassDefinition,
  FilePath,
  InterfaceDefinition,
  Location,
  MethodDefinition,
  PropertyDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { class_symbol, interface_symbol, method_symbol, property_symbol } from "@ariadnejs/types";

/** A declaration's span, one per line so two names never share a SymbolId. */
function location_at(file: FilePath, line: number): Location {
  return { file_path: file, start_line: line, start_column: 0, end_line: line, end_column: 10 };
}

interface Declared {
  readonly type_id: SymbolId;
  readonly definitions: readonly AnyDefinition[];
}

let next_line = 1;

/** A method named `name` on the type declared at `owner_scope`. */
function method(file: FilePath, owner_scope: ScopeId, name: string): MethodDefinition {
  const location = location_at(file, next_line++);
  return {
    kind: "method",
    symbol_id: method_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: owner_scope,
    location,
    parameters: [],
    body_scope_id: `${owner_scope}.${name}` as ScopeId,
    decorators: [],
  };
}

function property(file: FilePath, owner_scope: ScopeId, name: string): PropertyDefinition {
  const location = location_at(file, next_line++);
  return {
    kind: "property",
    symbol_id: property_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: owner_scope,
    location,
    decorators: [],
  };
}

/** An interface declaring `methods` as methods and `properties` as properties. */
function declare_interface(
  file: FilePath,
  name: string,
  methods: readonly string[],
  options: { readonly properties?: readonly string[]; readonly extends?: readonly string[] } = {}
): Declared {
  const location = location_at(file, next_line++);
  const type_id = interface_symbol(name as SymbolName, location);
  const scope_id = `scope:${file}:${name}` as ScopeId;
  const members = methods.map((member) => method(file, scope_id, member));
  const props = (options.properties ?? []).map((member) => property(file, scope_id, member));
  const definition: InterfaceDefinition = {
    kind: "interface",
    symbol_id: type_id,
    name: name as SymbolName,
    defining_scope_id: `scope:${file}:file` as ScopeId,
    location,
    is_exported: true,
    extends: (options.extends ?? []) as SymbolName[],
    methods: members,
    properties: props,
  };
  return { type_id, definitions: [definition, ...members, ...props] };
}

function declare_class(
  file: FilePath,
  name: string,
  methods: readonly string[],
  options: { readonly properties?: readonly string[]; readonly extends?: readonly string[] } = {}
): Declared {
  const location = location_at(file, next_line++);
  const type_id = class_symbol(name as SymbolName, location);
  const scope_id = `scope:${file}:${name}` as ScopeId;
  const members = methods.map((member) => method(file, scope_id, member));
  const props = (options.properties ?? []).map((member) => property(file, scope_id, member));
  const definition: ClassDefinition = {
    kind: "class",
    symbol_id: type_id,
    name: name as SymbolName,
    defining_scope_id: `scope:${file}:file` as ScopeId,
    location,
    is_exported: true,
    extends: (options.extends ?? []) as SymbolName[],
    methods: members,
    properties: props,
    decorators: [],
    constructors: [],
  };
  return { type_id, definitions: [definition, ...members, ...props] };
}

describe("structural conformance", () => {
  const FILE = "conformance.ts" as FilePath;
  let definitions: DefinitionRegistry;

  beforeEach(() => {
    next_line = 1;
    definitions = new DefinitionRegistry();
  });

  /** The interfaces `pending` that gain an edge when `changed` are the pass's changed types. */
  function infer_for_pass(changed: readonly SymbolId[], pending: readonly SymbolId[]): SymbolId[] {
    return [...infer_conformance_to_pending_interfaces(new Set(changed), pending, definitions)];
  }

  /** Register `declared` as one file's definitions and name each type's parents. */
  function load(declared: readonly Declared[], heritage: readonly [SymbolId, SymbolId][] = []): void {
    definitions.update_file(
      FILE,
      declared.flatMap((entry) => [...entry.definitions])
    );
    for (const [parent_id, subtype_id] of heritage) {
      definitions["heritage"].register_subtype(parent_id, subtype_id, "declared", FILE);
    }
  }

  it("infers the one class covering every member an interface names", () => {
    const facade = declare_interface(FILE, "CompilerFacade", [
      "compileNgModule",
      "compileComponent",
      "compilePipe",
    ]);
    const impl = declare_class(FILE, "CompilerFacadeImpl", [
      "compileNgModule",
      "compileComponent",
      "compilePipe",
    ]);
    const unrelated = declare_class(FILE, "Partial", ["compileNgModule", "compilePipe"]);
    load([facade, impl, unrelated]);

    expect(infer_structural_subtypes(facade.type_id, definitions)).toEqual([impl.type_id]);
  });

  it("does not match a class missing one member", () => {
    const facade = declare_interface(FILE, "CompilerFacade", ["compileNgModule", "compileComponent", "compilePipe"]);
    const near = declare_class(FILE, "NearlyImpl", ["compileNgModule", "compileComponent"]);
    load([facade, near]);

    expect(infer_structural_subtypes(facade.type_id, definitions)).toEqual([]);
  });

  it("counts coverage a superclass supplies", () => {
    const environment = declare_interface(FILE, "TcbEnvironment", [
      "reference",
      "referenceType",
      "canReferenceType",
    ]);
    const base = declare_class(FILE, "BaseEnvironment", ["reference", "referenceType"]);
    const derived = declare_class(FILE, "TypeCheckEnvironment", ["canReferenceType"], {
      extends: ["BaseEnvironment"],
    });
    load([environment, base, derived], [[base.type_id, derived.type_id]]);

    expect(infer_structural_subtypes(environment.type_id, definitions)).toEqual([derived.type_id]);
  });

  it("requires the members an interface inherits as well as its own", () => {
    const disposable = declare_interface(FILE, "IDisposable", ["dispose", "isDisposed"]);
    const contribution = declare_interface(FILE, "IEditorContribution", ["saveViewState"], {
      extends: ["IDisposable"],
    });
    const partial = declare_class(FILE, "PartialContribution", ["saveViewState", "dispose"]);
    const full = declare_class(FILE, "FullContribution", [
      "saveViewState",
      "dispose",
      "isDisposed",
    ]);
    load([disposable, contribution, partial, full], [[disposable.type_id, contribution.type_id]]);

    expect(infer_structural_subtypes(contribution.type_id, definitions)).toEqual([full.type_id]);
  });

  it("matches two same-named replica interfaces independently, each keeping its own id", () => {
    const members = ["compileNgModule", "compileComponent", "compilePipe"];
    const core = declare_interface(FILE, "CompilerFacade", members);
    const compiler = declare_interface(FILE, "CompilerFacade", members);
    const impl = declare_class(FILE, "CompilerFacadeImpl", members);
    load([core, compiler, impl]);

    expect(core.type_id).not.toEqual(compiler.type_id);
    expect(infer_structural_subtypes(core.type_id, definitions)).toEqual([impl.type_id]);
    expect(infer_structural_subtypes(compiler.type_id, definitions)).toEqual([impl.type_id]);
  });

  describe("the member floor", () => {
    it("never matches a one-method interface, whatever carries the name", () => {
      const disposable = declare_interface(FILE, "IDisposable", ["dispose"]);
      const carriers = ["Widget", "Editor", "Model"].map((name) =>
        declare_class(FILE, name, ["dispose"])
      );
      load([disposable, ...carriers]);

      expect(infer_structural_subtypes(disposable.type_id, definitions)).toEqual([]);
    });

    it("never matches a two-method interface, the shape the measured floor refuses", () => {
      const tokens = declare_interface(FILE, "RDomTokenList", ["add", "remove"]);
      const carriers = ["TimerScheduler", "PendingTasks", "EffectScheduler"].map((name) =>
        declare_class(FILE, name, ["add", "remove"])
      );
      load([tokens, ...carriers]);

      expect(infer_structural_subtypes(tokens.type_id, definitions)).toEqual([]);
    });

    it("refuses an answer wider than the fan-out bound, whole", () => {
      // vscode's shape: a three-method widget protocol every widget carries.
      const widget = declare_interface(FILE, "IWidget", ["layout", "focus", "dispose"]);
      const carriers = Array.from({ length: 33 }, (_, index) =>
        declare_class(FILE, `Widget${index}`, ["layout", "focus", "dispose"])
      );
      load([widget, ...carriers]);

      expect(infer_structural_subtypes(widget.type_id, definitions)).toEqual([]);

      // One fewer and the same answer stands: the bound is on the width alone.
      definitions.update_file(
        FILE,
        [widget, ...carriers.slice(0, 32)].flatMap((entry) => [...entry.definitions])
      );
      expect(infer_structural_subtypes(widget.type_id, definitions).length).toBe(32);
    });

    it("never matches on properties alone", () => {
      const shape = declare_interface(FILE, "Identified", [], {
        properties: ["id", "name", "kind"],
      });
      const record = declare_class(FILE, "Record", [], { properties: ["id", "name", "kind"] });
      load([shape, record]);

      expect(infer_structural_subtypes(shape.type_id, definitions)).toEqual([]);
    });

    it("requires every member, properties included, once the methods clear the floor", () => {
      const shape = declare_interface(FILE, "Serializer", ["encode", "decode", "reset"], {
        properties: ["format"],
      });
      const without_property = declare_class(FILE, "RawSerializer", [
        "encode",
        "decode",
        "reset",
      ]);
      const with_property = declare_class(FILE, "JsonSerializer", ["encode", "decode", "reset"], {
        properties: ["format"],
      });
      load([shape, without_property, with_property]);

      expect(infer_structural_subtypes(shape.type_id, definitions)).toEqual([with_property.type_id]);
    });
  });

  it("infers nothing for an interface a class already declares", () => {
    const members = ["compileNgModule", "compileComponent", "compilePipe"];
    const facade = declare_interface(FILE, "CompilerFacade", members);
    const declarer = declare_class(FILE, "DeclaredImpl", ["compileNgModule"]);
    const conformer = declare_class(FILE, "ConformingImpl", members);
    load([facade, declarer, conformer], [[facade.type_id, declarer.type_id]]);

    // The conforming class matches on its members, but the interface's answer is
    // in the source, so `method_lookup` never asks and the interface never joins
    // the pending set this module is handed.
    expect(infer_structural_subtypes(facade.type_id, definitions)).toEqual([conformer.type_id]);
    expect(definitions.has_declared_subtype(facade.type_id)).toBe(true);
  });

  it("answers for a class receiver and for a non-interface parent with nothing", () => {
    const facade = declare_class(FILE, "Facade", ["one", "two", "three"]);
    const impl = declare_class(FILE, "FacadeImpl", ["one", "two", "three"]);
    load([facade, impl]);

    expect(infer_structural_subtypes(facade.type_id, definitions)).toEqual([]);
    expect(infer_for_pass([impl.type_id], [facade.type_id])).toEqual([]);
    expect([...definitions.get_subtypes(facade.type_id)]).toEqual([]);
  });

  it("never names an interface as a conforming subtype", () => {
    const members = ["compileNgModule", "compileComponent", "compilePipe"];
    const facade = declare_interface(FILE, "CompilerFacade", members);
    const replica = declare_interface(FILE, "CompilerFacadeReplica", members);
    load([facade, replica]);

    expect(infer_structural_subtypes(facade.type_id, definitions)).toEqual([]);
    expect(infer_for_pass([replica.type_id], [facade.type_id])).toEqual([]);
    expect([...definitions.get_subtypes(facade.type_id)]).toEqual([]);
  });

  describe("the pass step over the types that just arrived", () => {
    it("connects the interface a newly-arrived class covers, and only that class", () => {
      const members = ["compileNgModule", "compileComponent", "compilePipe"];
      const facade = declare_interface(FILE, "CompilerFacade", members);
      const impl = declare_class(FILE, "CompilerFacadeImpl", members);
      const near = declare_class(FILE, "NearlyImpl", ["compileNgModule", "compilePipe"]);
      load([facade, impl, near]);

      expect(infer_for_pass([impl.type_id, near.type_id], [facade.type_id])).toEqual([
        facade.type_id,
      ]);
      expect([...definitions.get_subtypes(facade.type_id)]).toEqual([impl.type_id]);
    });

    it("tests the classes below a changed type, which is where a base completes coverage", () => {
      const environment = declare_interface(FILE, "TcbEnvironment", [
        "reference",
        "referenceType",
        "canReferenceType",
      ]);
      const base = declare_class(FILE, "BaseEnvironment", ["reference", "referenceType"]);
      const derived = declare_class(FILE, "Environment", ["canReferenceType"], {
        extends: ["BaseEnvironment"],
      });
      load([environment, base, derived], [[base.type_id, derived.type_id]]);

      // Only the base arrived, and the base covers two of the three members: the
      // class that conforms is the one below it.
      expect(infer_for_pass([base.type_id], [environment.type_id])).toEqual([environment.type_id]);
      expect([...definitions.get_subtypes(environment.type_id)]).toEqual([derived.type_id]);
    });

    it("refuses an interface below the floor, whatever just arrived covers", () => {
      const disposable = declare_interface(FILE, "IDisposable", ["dispose"]);
      const widget = declare_class(FILE, "Widget", ["dispose"]);
      load([disposable, widget]);

      expect(infer_for_pass([widget.type_id], [disposable.type_id])).toEqual([]);
      expect([...definitions.get_subtypes(disposable.type_id)]).toEqual([]);
    });
  });
});
