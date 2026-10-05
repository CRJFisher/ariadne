import { describe, it, expect, beforeEach } from "vitest";
import type { FilePath, SymbolId } from "@ariadnejs/types";
import { SubtypeGraph } from "./subtype_graph";

const child_file = "child.ts" as FilePath;
const impl_file = "impl.rs" as FilePath;

const child = "class:child.ts:1:0:5:1:Child" as SymbolId;
const base = "class:base.ts:1:0:5:1:Base" as SymbolId;
const contract = "interface:contract.ts:1:0:5:1:Contract" as SymbolId;
const inferred = "interface:inferred.ts:1:0:5:1:Disposable" as SymbolId;

describe("SubtypeGraph", () => {
  let graph: SubtypeGraph;

  beforeEach(() => {
    graph = new SubtypeGraph();
  });

  describe("register_subtype", () => {
    it("records the edge in both directions, parents in registration order", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(contract, child, "declared", child_file);

      expect(graph.get_parent_types(child)).toEqual([base, contract]);
      expect([...graph.get_subtypes(base)]).toEqual([child]);
      expect([...graph.get_subtypes(contract)]).toEqual([child]);
      expect(graph.verify()).toBeNull();
    });

    it("keeps the first registration of an edge, its source and its writer", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(base, child, "structural", impl_file);

      expect(graph.get_parent_types(child)).toEqual([base]);
      expect(graph.declared_edges_written_by(child_file)).toEqual(new Map([[child, new Set([base])]]));
      expect(graph.declared_edges_written_by(impl_file)).toEqual(new Map());
      expect(graph.verify()).toBeNull();
    });

    it("puts a declared parent ahead of a structural one registered before it", () => {
      graph.register_subtype(inferred, child, "structural", child_file);
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(contract, child, "declared", child_file);

      expect(graph.get_parent_types(child)).toEqual([base, contract, inferred]);
      expect(graph.verify()).toBeNull();
    });
  });

  describe("get_supertype_closure", () => {
    it("collects the given types and every type they transitively extend or implement", () => {
      const grandchild = "class:grandchild.ts:1:0:5:1:Grandchild" as SymbolId;
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(contract, base, "declared", child_file);
      graph.register_subtype(inferred, grandchild, "structural", impl_file);

      expect(graph.get_supertype_closure([child])).toEqual(new Set([child, base, contract]));
      expect(graph.get_supertype_closure([child, grandchild])).toEqual(
        new Set([child, base, contract, grandchild, inferred])
      );
      expect(graph.get_supertype_closure([contract])).toEqual(new Set([contract]));
      expect(graph.get_supertype_closure([])).toEqual(new Set());
    });

    it("ends a cycle in a malformed graph at the first type met twice", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(child, base, "declared", child_file);

      expect(graph.get_supertype_closure([child])).toEqual(new Set([child, base]));
    });
  });

  describe("get_subtype_closure", () => {
    it("collects every type transitively below the root, the root excluded", () => {
      const grandchild = "class:grandchild.ts:1:0:5:1:Grandchild" as SymbolId;
      graph.register_subtype(contract, base, "declared", child_file);
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(child, grandchild, "structural", impl_file);

      expect(graph.get_subtype_closure(contract)).toEqual(new Set([base, child, grandchild]));
      expect(graph.get_subtype_closure(child)).toEqual(new Set([grandchild]));
      expect(graph.get_subtype_closure(grandchild)).toEqual(new Set());
    });

    it("ends a cycle in a malformed graph at the first type met twice", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(child, base, "declared", child_file);

      expect(graph.get_subtype_closure(base)).toEqual(new Set([child, base]));
    });
  });

  describe("has_declared_subtype", () => {
    it("answers only for an edge a declaration wrote, so an inferred one leaves the type open", () => {
      graph.register_subtype(inferred, child, "structural", child_file);
      graph.register_subtype(contract, base, "declared", child_file);

      expect(graph.has_declared_subtype(inferred)).toBe(false);
      expect(graph.has_declared_subtype(contract)).toBe(true);
      expect(graph.has_declared_subtype(child)).toBe(false);
    });

    it("answers true once a declaration joins the structural edges already held", () => {
      graph.register_subtype(inferred, child, "structural", child_file);
      expect(graph.has_declared_subtype(inferred)).toBe(false);

      graph.register_subtype(inferred, base, "declared", child_file);
      expect(graph.has_declared_subtype(inferred)).toBe(true);
    });
  });

  describe("forget_type", () => {
    it("drops the edges a type sits on as a parent and as a subtype, whichever file wrote them", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(contract, base, "declared", impl_file);

      graph.forget_type(base);

      expect(graph.get_parent_types(child)).toEqual([]);
      expect(graph.get_parent_types(base)).toEqual([]);
      expect([...graph.get_subtypes(contract)]).toEqual([]);
      expect(graph.declared_edges_written_by(child_file)).toEqual(new Map());
      expect(graph.declared_edges_written_by(impl_file)).toEqual(new Map());
      expect(graph.verify()).toBeNull();
    });
  });

  describe("forget_edges_written_by", () => {
    it("drops every edge the file wrote and leaves another file's edges on the same subtype", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(contract, child, "declared", impl_file);
      graph.register_subtype(inferred, child, "structural", impl_file);

      graph.forget_edges_written_by(impl_file);

      expect(graph.get_parent_types(child)).toEqual([base]);
      expect(graph.verify()).toBeNull();
    });
  });

  describe("forget_declared_edges_written_by", () => {
    it("drops the file's declared edges and keeps its structural ones", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(inferred, child, "structural", child_file);

      graph.forget_declared_edges_written_by(child_file);

      expect(graph.get_parent_types(child)).toEqual([inferred]);
      expect(graph.declared_edges_written_by(child_file)).toEqual(new Map());
      expect(graph.verify()).toBeNull();
    });
  });

  describe("verify", () => {
    it("names a parent listed twice", () => {
      graph.register_subtype(base, child, "declared", child_file);

      graph["parent_types"].get(child)!.push(base);

      expect(graph.verify()).toEqual(`parent_types["${child}"] lists a parent more than once`);
    });

    it("names a declared parent behind a structural one", () => {
      graph.register_subtype(base, child, "declared", child_file);
      graph.register_subtype(inferred, child, "structural", child_file);

      graph["parent_types"].get(child)!.reverse();

      expect(graph.verify()).toEqual(
        `parent_types["${child}"] lists a declared parent behind a structural one`
      );
    });

    it("names an inverse entry the forward map no longer holds", () => {
      graph.register_subtype(base, child, "declared", child_file);

      graph["type_subtypes"].clear();

      expect(graph.verify()).toContain(`parent_types still holds "${child}"`);
    });

    it("names an edge its writing file does not record", () => {
      graph.register_subtype(base, child, "declared", child_file);

      graph["edges_by_file"].clear();

      expect(graph.verify()).toContain("edges_by_file is missing");
    });
  });

  it("clear empties every index", () => {
    graph.register_subtype(base, child, "declared", child_file);

    graph.clear();

    expect(graph.get_parent_types(child)).toEqual([]);
    expect([...graph.get_subtypes(base)]).toEqual([]);
    expect(graph.declared_edges_written_by(child_file)).toEqual(new Map());
    expect(graph.verify()).toBeNull();
  });
});
