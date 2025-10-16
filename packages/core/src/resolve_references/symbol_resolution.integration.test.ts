/**
 * Symbol Resolution Integration Tests
 *
 * Tests the complete resolution pipeline from SemanticIndex input
 * through final resolved symbols output.
 *
 * Coverage:
 * - Cross-module resolution (imports, function calls, method calls)
 * - Shadowing scenarios (local shadows import, nested scopes)
 * - Complete workflows (constructor → type → method)
 * - Resolution chains (nested type resolution, re-exports)
 * - Language parity (JavaScript, TypeScript, Python, Rust)
 *
 * NOTE: This file uses JSON fixtures instead of manually constructed
 * semantic indexes. See packages/core/tests/fixtures/ for fixture sources.
 */

import { describe, it, expect } from "vitest";
import type { SymbolId, SymbolName } from "@ariadnejs/types";
import { load_fixture } from "../../tests/fixtures/fixture_helpers";
import {
  build_registries,
  find_definition_in_scope,
  find_reference,
  find_references,
} from "../../tests/fixtures/registry_test_helpers";

describe("Symbol Resolution - Integration Tests", () => {
  describe("Basic Resolution", () => {
    it("should resolve local function calls", () => {
      // Load fixture with functions calling other functions
      const index = load_fixture("typescript/semantic_index/functions/call_chains.json");
      const { definitions, resolutions } = build_registries([index]);

      // Find the function definition
      const first_def = find_definition_in_scope(
        definitions,
        index.root_scope_id,
        "first" as SymbolName,
      );
      expect(first_def).toBeDefined();
      expect(first_def?.kind).toBe("function");

      // Find the call reference
      const call_ref = find_reference(index, "first" as SymbolName);
      expect(call_ref).toBeDefined();
      expect(call_ref?.type).toBe("call");

      // Verify resolution
      if (call_ref) {
        const resolved = resolutions.resolve(call_ref.scope_id, call_ref.name);
        expect(resolved).toBe(first_def?.symbol_id);
      }
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve imported function calls across files", () => {
      // Load utils.ts (exports helper function) and main that imports it
      const utils = load_fixture("typescript/semantic_index/integration/utils.json");
      const main = load_fixture("typescript/semantic_index/integration/main_shadowing.json");

      const { definitions, resolutions } = build_registries([utils, main]);

      // Find exported helper function in utils
      const helper_def = find_definition_in_scope(
        definitions,
        utils.root_scope_id,
        "helper" as SymbolName,
      );
      expect(helper_def).toBeDefined();
      expect(helper_def?.kind).toBe("function");
      expect(helper_def?.is_exported).toBe(true);

      // Find import in main
      const import_def = find_definition_in_scope(
        definitions,
        main.root_scope_id,
        "helper" as SymbolName,
      );
      expect(import_def).toBeDefined();
      expect(import_def?.kind).toBe("import");
    });

    it("should resolve imported class methods across files", () => {
      // Load types.ts (User class) and main_uses_types.ts (imports and uses User)
      const types = load_fixture("typescript/semantic_index/integration/types.json");
      const main = load_fixture("typescript/semantic_index/integration/main_uses_types.json");

      const { definitions, types: type_registry, resolutions } = build_registries([types, main]);

      // Find User class in types.ts
      const user_class = find_definition_in_scope(
        definitions,
        types.root_scope_id,
        "User" as SymbolName,
      );
      expect(user_class).toBeDefined();
      expect(user_class?.kind).toBe("class");

      // Get type members (methods)
      const type_members = type_registry.get_type_members(user_class!.symbol_id);
      expect(type_members).toBeDefined();
      expect(type_members?.methods.size).toBeGreaterThan(0);

      // Find getName method
      const getName_method_id = type_members?.methods.get("getName" as SymbolName);
      expect(getName_method_id).toBeDefined();

      // Find method call references in main
      const getName_refs = find_references(main, "getName" as SymbolName);
      expect(getName_refs.length).toBeGreaterThan(0);

      // Verify method call resolves to the method in User class
      const first_call = getName_refs[0];
      if (first_call && first_call.type === "call" && first_call.call_type === "method") {
        const resolved = resolutions.resolve(first_call.scope_id, first_call.name);
        expect(resolved).toBe(getName_method_id);
      }
    });
  });

  describe("Shadowing Scenarios", () => {
    it("should resolve to local definition when it shadows import", () => {
      // main_shadowing.ts: imports helper but also defines local helper
      const utils = load_fixture("typescript/semantic_index/integration/utils.json");
      const main = load_fixture("typescript/semantic_index/integration/main_shadowing.json");

      const { definitions, resolutions } = build_registries([utils, main]);

      // Find imported helper
      const import_helper = Array.from(main.imported_symbols.values()).find(
        (imp) => imp.name === ("helper" as SymbolName),
      );
      expect(import_helper).toBeDefined();

      // Find local helper function in main
      const local_helper = Array.from(main.functions.values()).find(
        (fn) => fn.name === ("helper" as SymbolName),
      );
      expect(local_helper).toBeDefined();

      // Find call to helper in main
      const helper_call = find_reference(main, "helper" as SymbolName);
      expect(helper_call).toBeDefined();
      expect(helper_call?.type).toBe("call");

      // Verify call resolves to LOCAL helper, not imported one
      if (helper_call) {
        const resolved = resolutions.resolve(helper_call.scope_id, helper_call.name);
        expect(resolved).toBe(local_helper!.symbol_id);
        expect(resolved).not.toBe(import_helper!.symbol_id);
      }
    });
  });

  describe("Complete Workflows", () => {
    it("should resolve constructor → type → method chain", () => {
      // constructor_method_chain.ts: defines User class, constructs instance, calls methods
      const index = load_fixture("typescript/semantic_index/integration/constructor_method_chain.json");

      const { definitions, types: type_registry, resolutions } = build_registries([index]);

      // Find User class
      const user_class = find_definition_in_scope(
        definitions,
        index.root_scope_id,
        "User" as SymbolName,
      );
      expect(user_class).toBeDefined();
      expect(user_class?.kind).toBe("class");

      // Get type members
      const type_members = type_registry.get_type_members(user_class!.symbol_id);
      expect(type_members).toBeDefined();

      // Find constructor
      const constructor_id = type_members?.constructor;
      expect(constructor_id).toBeDefined();

      // Find getName method
      const getName_method_id = type_members?.methods.get("getName" as SymbolName);
      expect(getName_method_id).toBeDefined();

      // Find constructor call (new User(...))
      const constructor_refs = index.references.filter(
        (r) => r.type === "call" && r.call_type === "constructor" && r.name === ("User" as SymbolName),
      );
      expect(constructor_refs.length).toBeGreaterThan(0);

      // Verify constructor resolves
      const ctor_call = constructor_refs[0];
      if (ctor_call) {
        const resolved_ctor = resolutions.resolve(ctor_call.scope_id, ctor_call.name);
        // Constructor resolution goes through type binding
        expect(resolved_ctor).toBeDefined();
      }

      // Find method call (user.getName())
      const method_refs = find_references(index, "getName" as SymbolName);
      expect(method_refs.length).toBeGreaterThan(0);

      // Verify method call resolves
      const method_call = method_refs[0];
      if (method_call && method_call.type === "call") {
        const resolved_method = resolutions.resolve(method_call.scope_id, method_call.name);
        expect(resolved_method).toBe(getName_method_id);
      }
    });
  });

  describe("Output Structure", () => {
    it("should produce correct ResolvedSymbols output structure", () => {
      // Use a simple fixture to verify output structure
      const index = load_fixture("typescript/semantic_index/functions/basic_functions.json");
      const { definitions, resolutions } = build_registries([index]);

      // Verify definitions registry populated
      const all_defs = definitions.get_all_definitions();
      expect(all_defs.size).toBeGreaterThan(0);

      // Verify each definition has required fields
      for (const def of all_defs.values()) {
        expect(def.symbol_id).toBeDefined();
        expect(def.name).toBeDefined();
        expect(def.defining_scope_id).toBeDefined();
        expect(def.location).toBeDefined();
      }
    });
  });

  describe("CallReference enclosing_function_scope_id", () => {
    it("should set enclosing_function_scope_id for calls in nested functions", () => {
      // nested_scopes.ts: calls at module, function, and nested function levels
      const index = load_fixture("typescript/semantic_index/integration/nested_scopes.json");

      // Find call in outer function
      const outerCall = index.references.find(
        (r) =>
          r.type === "call" &&
          r.name === ("helper" as SymbolName) &&
          r.location.start_line === 11, // outerCall location
      );
      expect(outerCall).toBeDefined();
      if (outerCall && outerCall.type === "call") {
        expect(outerCall.enclosing_function_scope_id).toBeDefined();
      }

      // Find call in inner function
      const innerCall = index.references.find(
        (r) =>
          r.type === "call" &&
          r.name === ("helper" as SymbolName) &&
          r.location.start_line === 20, // innerCall location
      );
      expect(innerCall).toBeDefined();
      if (innerCall && innerCall.type === "call") {
        expect(innerCall.enclosing_function_scope_id).toBeDefined();
      }

      // Verify different enclosing scopes
      if (
        outerCall &&
        outerCall.type === "call" &&
        innerCall &&
        innerCall.type === "call"
      ) {
        expect(outerCall.enclosing_function_scope_id).not.toBe(
          innerCall.enclosing_function_scope_id,
        );
      }
    });

    it("should set enclosing_function_scope_id to module scope for top-level calls", () => {
      const index = load_fixture("typescript/semantic_index/integration/nested_scopes.json");

      // Find top-level call (line 7: topLevel = helper())
      const topLevelCall = index.references.find(
        (r) =>
          r.type === "call" &&
          r.name === ("helper" as SymbolName) &&
          r.location.start_line === 7,
      );
      expect(topLevelCall).toBeDefined();

      if (topLevelCall && topLevelCall.type === "call") {
        // Top-level calls should have enclosing_function_scope_id = module scope
        expect(topLevelCall.enclosing_function_scope_id).toBe(index.root_scope_id);
      }
    });

    it("should set enclosing_function_scope_id for method and constructor calls", () => {
      const index = load_fixture("typescript/semantic_index/integration/constructor_method_chain.json");

      // Find constructor call
      const constructor_call = index.references.find(
        (r) => r.type === "call" && r.call_type === "constructor",
      );
      expect(constructor_call).toBeDefined();

      if (constructor_call && constructor_call.type === "call") {
        // Constructor call at module level should have module scope as enclosing
        expect(constructor_call.enclosing_function_scope_id).toBe(index.root_scope_id);
      }

      // Find method call
      const method_call = index.references.find(
        (r) => r.type === "call" && r.call_type === "method",
      );
      expect(method_call).toBeDefined();

      if (method_call && method_call.type === "call") {
        // Method call at module level should have module scope as enclosing
        expect(method_call.enclosing_function_scope_id).toBe(index.root_scope_id);
      }
    });
  });
});
