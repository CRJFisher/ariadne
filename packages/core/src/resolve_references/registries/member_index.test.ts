import { describe, it, expect } from "vitest";
import { MemberIndex, first_divergence } from "./member_index";
import { class_symbol, method_symbol, property_symbol } from "@ariadnejs/types";
import type {
  AnyDefinition,
  ClassDefinition,
  ConstructorDefinition,
  FilePath,
  Location,
  MethodDefinition,
  PropertyDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";

function location(file_id: FilePath, line: number): Location {
  return {
    file_path: file_id,
    start_line: line,
    start_column: 2,
    end_line: line,
    end_column: 20,
  };
}

function method(
  file_id: FilePath,
  name: string,
  line: number,
  accessor_kind?: "getter" | "setter" | "deleter"
): MethodDefinition {
  const loc = location(file_id, line);
  return {
    kind: "method",
    symbol_id: method_symbol(name as SymbolName, loc),
    name: name as SymbolName,
    defining_scope_id: `scope:${file_id}:class` as ScopeId,
    location: loc,
    parameters: [],
    body_scope_id: `scope:${file_id}:class:${name}` as ScopeId,
    decorators: [],
    ...(accessor_kind ? { accessor_kind } : {}),
  };
}

function property(
  file_id: FilePath,
  name: string,
  line: number,
  initial_value?: string
): PropertyDefinition {
  const loc = location(file_id, line);
  return {
    kind: "property",
    symbol_id: property_symbol(name as SymbolName, loc),
    name: name as SymbolName,
    defining_scope_id: `scope:${file_id}:class` as ScopeId,
    location: loc,
    decorators: [],
    ...(initial_value !== undefined ? { initial_value } : {}),
  };
}

function class_constructor(file_id: FilePath, line: number): ConstructorDefinition {
  const loc = location(file_id, line);
  return {
    kind: "constructor",
    symbol_id: method_symbol("constructor" as SymbolName, loc),
    name: "constructor" as SymbolName,
    defining_scope_id: `scope:${file_id}:class` as ScopeId,
    location: loc,
    parameters: [],
    body_scope_id: `scope:${file_id}:class:constructor` as ScopeId,
  };
}

function bare_class(file_id: FilePath, name: string, line: number): ClassDefinition {
  return {
    kind: "class",
    symbol_id: class_symbol(name, location(file_id, line)),
    name: name as SymbolName,
    defining_scope_id: `scope:${file_id}:module` as ScopeId,
    location: location(file_id, line),
    is_exported: true,
    extends: [],
    methods: [],
    properties: [],
    decorators: [],
  };
}

function names_of(members: ReadonlyMap<SymbolName, SymbolId> | undefined): string[] {
  return [...(members ?? new Map()).keys()].sort();
}

function index_over(...defs: AnyDefinition[]): MemberIndex {
  const definitions = new Map<SymbolId, AnyDefinition>();
  for (const def of defs) {
    definitions.set(def.symbol_id, def);
  }
  return new MemberIndex(definitions);
}

describe("MemberIndex", () => {
  const file_a = "a.ts" as FilePath;
  const file_b = "b.ts" as FilePath;
  const type_id = class_symbol("Widget", location(file_a, 1));

  describe("ownership edges", () => {
    it("resolves an owner from either direction and forgets one member without disturbing its siblings", () => {
      const m1 = method(file_a, "run", 1);
      const m2 = method(file_a, "stop", 2);
      const index = index_over(m1, m2);

      index.register_member_owner(m1.symbol_id, type_id);
      index.register_member_owner(m2.symbol_id, type_id);

      expect(index.get_member_owner(m1.symbol_id)).toBe(type_id);
      expect(index.get_member_owner(m2.symbol_id)).toBe(type_id);

      index.forget_member(m1.symbol_id);

      expect(index.get_member_owner(m1.symbol_id)).toBeUndefined();
      expect(index.get_member_owner(m2.symbol_id)).toBe(type_id);
    });

    it("forgets every member a type owns and leaves an unrelated type's edges", () => {
      const m1 = method(file_a, "run", 1);
      const m2 = method(file_a, "stop", 2);
      const other_type = class_symbol("Other", location(file_a, 9));
      const m3 = method(file_a, "spin", 3);
      const index = index_over(m1, m2, m3);

      index.register_member_owner(m1.symbol_id, type_id);
      index.register_member_owner(m2.symbol_id, type_id);
      index.register_member_owner(m3.symbol_id, other_type);

      index.forget_owned_members(type_id);

      expect(index.get_member_owner(m1.symbol_id)).toBeUndefined();
      expect(index.get_member_owner(m2.symbol_id)).toBeUndefined();
      expect(index.get_member_owner(m3.symbol_id)).toBe(other_type);
    });
  });

  describe("attach_members and the callable-over-property rule", () => {
    it("attaches members under a fresh type and records provenance both ways", () => {
      const run = method(file_a, "run", 1);
      const state = property(file_a, "state", 2);
      const index = index_over(run, state);

      index.attach_members(type_id, [
        [run.name, run.symbol_id],
        [state.name, state.symbol_id],
      ]);

      expect(names_of(index.get_member_index().get(type_id))).toEqual(["run", "state"]);
      expect(index.get_members_by_name(run.name)).toEqual(new Set([type_id]));
      expect(index.get_members_by_name(state.name)).toEqual(new Set([type_id]));
      expect(index.verify()).toBeNull();
    });

    it("keeps a callable that a later property under the same name cannot displace", () => {
      const run = method(file_a, "run", 1);
      const run_field = property(file_b, "run", 1);
      const index = index_over(run, run_field);

      index.attach_members(type_id, [[run.name, run.symbol_id]]);
      index.attach_members(type_id, [[run_field.name, run_field.symbol_id]]);

      expect(index.get_member_index().get(type_id)?.get(run.name)).toBe(run.symbol_id);
      expect(index.verify()).toBeNull();
    });

    it("lets a callable displace a property already holding the name", () => {
      const run_field = property(file_a, "run", 1);
      const run = method(file_b, "run", 1);
      const index = index_over(run_field, run);

      index.attach_members(type_id, [[run_field.name, run_field.symbol_id]]);
      index.attach_members(type_id, [[run.name, run.symbol_id]]);

      expect(index.get_member_index().get(type_id)?.get(run.name)).toBe(run.symbol_id);
      index.forget_contributed_members(file_b);
      expect(index.get_member_index().get(type_id)?.get(run.name)).toBeUndefined();
      expect(index.verify()).toBeNull();
    });

    it("never lets a setter displace the getter that already holds the name", () => {
      const getter = method(file_a, "value", 1, "getter");
      const setter = method(file_b, "value", 1, "setter");
      const index = index_over(getter, setter);

      index.attach_members(type_id, [[getter.name, getter.symbol_id]]);
      index.attach_members(type_id, [[setter.name, setter.symbol_id]]);

      expect(index.get_member_index().get(type_id)?.get(getter.name)).toBe(getter.symbol_id);
      expect(index.verify()).toBeNull();
    });

    it("always lets a constructor take the slot, even one a callable already holds", () => {
      const run = method(file_a, "init", 1);
      const ctor = class_constructor(file_b, 1);
      const named_ctor = { ...ctor, name: "init" as SymbolName };
      const index = index_over(run, named_ctor);

      index.attach_members(type_id, [[run.name, run.symbol_id]]);
      index.attach_members(type_id, [[named_ctor.name, named_ctor.symbol_id]]);

      expect(index.get_member_index().get(type_id)?.get("init" as SymbolName)).toBe(
        named_ctor.symbol_id
      );
      expect(index.verify()).toBeNull();
    });

    it("refuses to attach a member the registry does not hold", () => {
      const index = new MemberIndex(new Map());
      const orphan_id = method_symbol("orphan" as SymbolName, location(file_a, 1));

      expect(() =>
        index.attach_members(type_id, [["orphan" as SymbolName, orphan_id]])
      ).toThrow(/does not hold/);
    });
  });

  describe("forget_contributed_members", () => {
    it("takes back exactly one file's names and leaves another file's contribution to the same type", () => {
      const run = method(file_a, "run", 1);
      const stop = method(file_b, "stop", 1);
      const index = index_over(run, stop);

      index.attach_members(type_id, [[run.name, run.symbol_id]]);
      index.attach_members(type_id, [[stop.name, stop.symbol_id]]);

      index.forget_contributed_members(file_a);

      expect(names_of(index.get_member_index().get(type_id))).toEqual(["stop"]);
      expect(index.get_members_by_name(run.name)).toEqual(new Set());
      expect(index.get_members_by_name(stop.name)).toEqual(new Set([type_id]));
      expect(index.verify()).toBeNull();
    });

    it("drops the type's own member-index entry once its last contributing file is evicted", () => {
      const run = method(file_a, "run", 1);
      const index = index_over(run);
      index.attach_members(type_id, [[run.name, run.symbol_id]]);

      index.forget_contributed_members(file_a);

      expect(index.get_member_index().has(type_id)).toBe(false);
      expect(index.verify()).toBeNull();
    });
  });

  describe("get_member_closure", () => {
    const child_id = class_symbol("Child", location(file_a, 20));
    const parent_id = class_symbol("Parent", location(file_a, 30));

    it("unions a type's own members with its same-kind parent's, the child's own name winning", () => {
      const child_class = bare_class(file_a, "Child", 20);
      const parent_class = bare_class(file_a, "Parent", 30);
      const child_run = method(file_a, "run", 21);
      const parent_run = method(file_a, "run", 31);
      const parent_only = method(file_a, "cleanup", 32);
      const definitions = new Map<SymbolId, AnyDefinition>([
        [child_id, { ...child_class, symbol_id: child_id }],
        [parent_id, { ...parent_class, symbol_id: parent_id }],
        [child_run.symbol_id, child_run],
        [parent_run.symbol_id, parent_run],
        [parent_only.symbol_id, parent_only],
      ]);
      const index = new MemberIndex(definitions);
      index.attach_members(child_id, [[child_run.name, child_run.symbol_id]]);
      index.attach_members(parent_id, [
        [parent_run.name, parent_run.symbol_id],
        [parent_only.name, parent_only.symbol_id],
      ]);
      const subtype_parents = new Map([[child_id, new Set([parent_id])]]);

      const closure = index.get_member_closure(child_id, subtype_parents);

      expect(names_of(closure)).toEqual(["cleanup", "run"]);
      expect(closure.get("run" as SymbolName)).toBe(child_run.symbol_id);
    });

    it("does not walk a parent whose declaration the registry no longer holds", () => {
      const child_class = bare_class(file_a, "Child", 20);
      const child_run = method(file_a, "run", 21);
      const definitions = new Map<SymbolId, AnyDefinition>([
        [child_id, { ...child_class, symbol_id: child_id }],
        [child_run.symbol_id, child_run],
      ]);
      const index = new MemberIndex(definitions);
      index.attach_members(child_id, [[child_run.name, child_run.symbol_id]]);
      const subtype_parents = new Map([[child_id, new Set([parent_id])]]);

      const closure = index.get_member_closure(child_id, subtype_parents);

      expect(names_of(closure)).toEqual(["run"]);
    });

    it("terminates on a cycle in the parent graph instead of looping forever", () => {
      const child_class = bare_class(file_a, "Child", 20);
      const parent_class = bare_class(file_a, "Parent", 30);
      const definitions = new Map<SymbolId, AnyDefinition>([
        [child_id, { ...child_class, symbol_id: child_id }],
        [parent_id, { ...parent_class, symbol_id: parent_id }],
      ]);
      const index = new MemberIndex(definitions);
      const subtype_parents = new Map([
        [child_id, new Set([parent_id])],
        [parent_id, new Set([child_id])],
      ]);

      const closure = index.get_member_closure(child_id, subtype_parents);

      expect(names_of(closure)).toEqual([]);
    });
  });

  describe("capture_member_aliases", () => {
    it("rebinds an alias property to the member its initializer names", () => {
      const real = method(file_a, "_getitem", 1);
      const alias = property(file_a, "__getitem__", 2, "_getitem");
      const class_def = { ...bare_class(file_a, "Store", 1), properties: [alias] };
      const index = index_over(real, alias);
      const members = new Map([[real.name, real.symbol_id]]);

      const rebindings = index.capture_member_aliases(class_def, members);

      expect(rebindings).toEqual([[alias.name, real.symbol_id]]);
    });

    it("ignores an alias whose initializer names no member and one that names itself", () => {
      const self_alias = property(file_a, "self_alias", 1, "self_alias");
      const dangling = property(file_a, "dangling", 2, "nothing_here");
      const class_def = {
        ...bare_class(file_a, "Store", 1),
        properties: [self_alias, dangling],
      };
      const index = index_over(self_alias, dangling);
      const members = new Map([
        [self_alias.name, self_alias.symbol_id],
        [dangling.name, dangling.symbol_id],
      ]);

      const rebindings = index.capture_member_aliases(class_def, members);

      expect(rebindings).toEqual([]);
    });
  });

  describe("verify and first_divergence", () => {
    it("reports no divergence over an index built entirely through its own writers", () => {
      const run = method(file_a, "run", 1);
      const index = index_over(run);
      index.register_member_owner(run.symbol_id, type_id);
      index.attach_members(type_id, [[run.name, run.symbol_id]]);

      expect(index.verify()).toBeNull();
    });

    it("clears every index it holds", () => {
      const run = method(file_a, "run", 1);
      const index = index_over(run);
      index.register_member_owner(run.symbol_id, type_id);
      index.attach_members(type_id, [[run.name, run.symbol_id]]);

      index.clear();

      expect(index.get_member_index().size).toBe(0);
      expect(index.get_member_owner(run.symbol_id)).toBeUndefined();
      expect(index.get_members_by_name(run.name)).toEqual(new Set());
    });
  });

  describe("first_divergence", () => {
    it("is null when a live reverse index and its rebuild agree", () => {
      const live = new Map([["a", new Set(["x", "y"])]]);
      const rebuilt = new Map([["a", new Set(["x", "y"])]]);

      expect(first_divergence(live, rebuilt, "live", "forward")).toBeNull();
    });

    it("names the key a write site populated forward but never wrote to the live index", () => {
      const live = new Map<string, Set<string>>();
      const rebuilt = new Map([["a", new Set(["x"])]]);

      expect(first_divergence(live, rebuilt, "live", "forward")).toMatch(
        /live is missing "a"/
      );
    });

    it("names a value the live index holds that an eviction should have dropped", () => {
      const live = new Map([["a", new Set(["x", "stale"])]]);
      const rebuilt = new Map([["a", new Set(["x"])]]);

      expect(first_divergence(live, rebuilt, "live", "forward")).toMatch(
        /live\["a"\] still holds "stale"/
      );
    });

    it("names a key the live index still holds after every value left it", () => {
      const live = new Map([["a", new Set(["x"])]]);
      const rebuilt = new Map<string, Set<string>>();

      expect(first_divergence(live, rebuilt, "live", "forward")).toMatch(
        /live still holds "a"/
      );
    });
  });
});
