import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import type { FilePath } from "@ariadnejs/types";
import { extract_constructor_bindings } from "../index_single_file/type_preprocessing";

describe("Debug Assignment Tracking", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  it("should trace TypeScript cross-file resolution step-by-step", async () => {
    // Setup: Cross-file scenario (same as failing test)
    project.update_file("types.ts" as FilePath, `
      export class User {
        getName() { return "Alice"; }
      }
    `);

    project.update_file("main.ts" as FilePath, `
      import { User } from "./types";
      const user = new User();
      const name = user.getName();
    `);

    // ===== CHECKPOINT 1: Semantic Index References =====
    console.log("\n===== CHECKPOINT 1: References =====");
    const main_index = project.get_semantic_index("main.ts" as FilePath)!;

    const constructor_ref = main_index.references.find(
      r => r.call_type === "constructor" && r.name === "User"
    );

    console.log("Constructor reference found:", !!constructor_ref);
    if (constructor_ref) {
      console.log("  - name:", constructor_ref.name);
      console.log("  - call_type:", constructor_ref.call_type);
      console.log("  - has context:", !!constructor_ref.context);
      console.log("  - has construct_target:", !!constructor_ref.context?.construct_target);
      if (constructor_ref.context?.construct_target) {
        console.log("  - construct_target location:", constructor_ref.context.construct_target);
      }
    }

    // ===== CHECKPOINT 2: Type Bindings Extraction =====
    console.log("\n===== CHECKPOINT 2: Type Bindings =====");
    const type_bindings = extract_constructor_bindings(main_index.references);
    console.log("Type bindings extracted:", type_bindings.size);
    for (const [loc_key, type_name] of type_bindings) {
      console.log(`  - ${loc_key} → ${type_name}`);
    }

    // ===== CHECKPOINT 3: Variable Definition =====
    console.log("\n===== CHECKPOINT 3: Variable Definition =====");

    // First, list ALL variables/constants in main.ts
    const all_main_vars = Array.from(project.definitions["by_symbol"].values()).filter(
      def => (def.kind === "variable" || def.kind === "constant") && def.location.file_path === "main.ts"
    );
    console.log("All variables/constants in main.ts:", all_main_vars.length);
    for (const v of all_main_vars) {
      console.log(`  - ${v.name} (${v.kind}) has scope_id? ${"scope_id" in v}`);
    }

    // Now try to find user variable
    const user_var = Array.from(project.definitions["by_symbol"].values()).find(
      def => def.kind === "variable" && def.name === "user"
    );
    console.log("\nUser variable found:", !!user_var);
    if (user_var) {
      console.log("  - symbol_id:", user_var.symbol_id);
      console.log("  - name:", user_var.name);
      console.log("  - location:", user_var.location);
    }

    // Try to lookup by location using location_to_symbol
    console.log("\nLookup by construct_target location:");
    if (constructor_ref?.context?.construct_target) {
      const loc = constructor_ref.context.construct_target;
      const loc_key = `${loc.file_path}:${loc.start_line}:${loc.start_column}:${loc.end_line}:${loc.end_column}`;
      console.log("  - Looking for:", loc_key);
      const symbol_at_loc = project.definitions["location_to_symbol"].get(loc_key);
      console.log("  - Found symbol_id:", symbol_at_loc);
      if (symbol_at_loc) {
        const def_at_loc = project.definitions.get(symbol_at_loc);
        console.log("  - Definition:", def_at_loc);
      }
    }

    // ===== CHECKPOINT 4: TypeRegistry Lookup =====
    console.log("\n===== CHECKPOINT 4: TypeRegistry =====");

    // Use the symbol_id we found via location lookup
    const user_symbol_id = constructor_ref?.context?.construct_target
      ? project.definitions["location_to_symbol"].get(
          `${constructor_ref.context.construct_target.file_path}:${constructor_ref.context.construct_target.start_line}:${constructor_ref.context.construct_target.start_column}:${constructor_ref.context.construct_target.end_line}:${constructor_ref.context.construct_target.end_column}`
        )
      : undefined;

    if (user_symbol_id) {
      console.log("User symbol_id:", user_symbol_id);
      const user_type = project.types.get_symbol_type(user_symbol_id);
      console.log("User type resolved:", !!user_type);
      if (user_type) {
        const type_def = project.definitions.get(user_type);
        console.log("  - type symbol_id:", user_type);
        console.log("  - type definition kind:", type_def?.kind);
        console.log("  - type definition name:", type_def?.name);
      } else {
        console.log("  - FAILED: No type found for user constant");
        console.log("  - This means TypeRegistry.resolve_type_metadata failed");
        console.log("  - Possible reasons:");
        console.log("    1. Type name 'User' not resolved in scope");
        console.log("    2. Import resolution not working");
        console.log("    3. Timing issue (imports resolved after TypeRegistry)");
      }
    } else {
      console.log("FAILED: Could not get symbol_id from location");
    }

    // ===== CHECKPOINT 5: Method Call Resolution =====
    console.log("\n===== CHECKPOINT 5: Method Resolution =====");
    const method_call = main_index.references.find(
      r => r.type === "call" && r.name === "getName"
    );
    console.log("Method call found:", !!method_call);
    if (method_call) {
      console.log("  - name:", method_call.name);
      console.log("  - call_type:", method_call.call_type);
      console.log("  - has receiver_location:", !!method_call.context?.receiver_location);
      console.log("  - property_chain:", method_call.context?.property_chain);
      if (method_call.context?.receiver_location) {
        console.log("  - receiver_location:", method_call.context.receiver_location);

        // Check if receiver is in location_to_symbol
        const receiver_loc = method_call.context.receiver_location;
        const receiver_loc_key = `${receiver_loc.file_path}:${receiver_loc.start_line}:${receiver_loc.start_column}:${receiver_loc.end_line}:${receiver_loc.end_column}`;
        console.log("  - receiver location key:", receiver_loc_key);

        const receiver_symbol_id = project.definitions["location_to_symbol"].get(receiver_loc_key);
        console.log("  - receiver symbol_id via location:", receiver_symbol_id);

        // Try resolving by name in scope instead
        console.log("  - Trying resolution by name in scope...");
        const receiver_ref = main_index.references.find(
          r => r.location.start_line === receiver_loc.start_line &&
               r.location.start_column === receiver_loc.start_column &&
               r.name === "user"
        );
        console.log("  - Found receiver reference:", !!receiver_ref);
        if (receiver_ref) {
          const resolved_receiver = project.resolutions.resolve(receiver_ref.scope_id, receiver_ref.name);
          console.log("  - Resolved receiver symbol_id:", resolved_receiver);

          if (resolved_receiver) {
            const receiver_type = project.types.get_symbol_type(resolved_receiver);
            console.log("  - Receiver type:", receiver_type);

            if (receiver_type) {
              // Check members of the User class
              const user_class_members = project.definitions.get_member_index().get(receiver_type);
              console.log("  - User class has members:", !!user_class_members);
              if (user_class_members) {
                console.log("  - User class member count:", user_class_members.size);
                console.log("  - User class member names:", Array.from(user_class_members.keys()));
                console.log("  - Has 'getName' method:", user_class_members.has("getName"));
              }

              // Also check TypeRegistry.get_type_member
              const getName_via_types = project.types.get_type_member(receiver_type, "getName");
              console.log("  - TypeRegistry.get_type_member('getName'):", getName_via_types);
            }
          }
        }

        if (receiver_symbol_id) {
          const receiver_type = project.types.get_symbol_type(receiver_symbol_id);
          console.log("  - receiver type:", receiver_type);

          if (receiver_type) {
            // Check if User class has getName method
            const user_class_members = project.definitions.get_member_index().get(receiver_type);
            console.log("  - User class members:", user_class_members);
          }
        }
      }

      // Manually call resolve_single_method_call to test the resolver
      console.log("\n  - Testing resolve_single_method_call directly...");
      const { resolve_single_method_call } = await import("../resolve_references/call_resolution/method_resolver");

      const resolved_method = resolve_single_method_call(
        method_call,
        project.scopes,
        project.definitions,
        project.types,
        project.resolutions
      );

      console.log("  - resolve_single_method_call result:", resolved_method);
      if (resolved_method) {
        const method_def = project.definitions.get(resolved_method);
        console.log("  - method definition:", method_def);
        console.log("\n  ✅ SUCCESS: Method resolver works!");
      } else {
        console.log("\n  ❌ FAILED: resolve_single_method_call returned null");
        console.log("  - This means there's a bug in the method resolver logic");
      }
    }

    // ===== FINAL VERDICT =====
    console.log("\n===== FINAL VERDICT =====");
    // Identify exactly where the chain breaks
  });

  it("should test JavaScript constructor bindings", async () => {
    console.log("\n========== JAVASCRIPT ==========");
    project.update_file("user_class.js" as FilePath, `
export class User {
  getName() { return "Alice"; }
}
    `);

    project.update_file("main.js" as FilePath, `
import { User } from "./user_class.js";
const user = new User();
const name = user.getName();
    `);

    const js_index = project.get_semantic_index("main.js" as FilePath)!;

    // Check constructor reference
    const constructor_ref = js_index.references.find(
      r => r.call_type === "constructor" && r.name === "User"
    );
    console.log("Constructor reference found:", !!constructor_ref);
    if (constructor_ref?.context?.construct_target) {
      console.log("  - construct_target:", constructor_ref.context.construct_target);
    }

    // Check type bindings extraction
    const js_bindings = extract_constructor_bindings(js_index.references);
    console.log("JavaScript constructor bindings:", js_bindings.size);
    for (const [loc_key, type_name] of js_bindings) {
      console.log(`  - ${loc_key} → ${type_name}`);
    }

    // Check if user variable is indexed
    const user_var = Array.from(project.definitions["by_symbol"].values()).find(
      def => (def.kind === "variable" || def.kind === "constant") && def.name === "user" && def.location.file_path === "main.js"
    );
    console.log("User variable found:", !!user_var);
    if (user_var) {
      console.log("  - location:", `${user_var.location.file_path}:${user_var.location.start_line}:${user_var.location.start_column}`);
    }

    // Check TypeRegistry
    if (user_var) {
      const user_type = project.types.get_symbol_type(user_var.symbol_id);
      console.log("User type from TypeRegistry:", user_type);
    }

    // Check resolved calls
    const resolved_calls = project.resolutions.get_file_calls("main.js" as FilePath);
    console.log("Resolved calls count:", resolved_calls.length);
    console.log("Resolved calls:", resolved_calls.map(c => ({ name: c.name, type: c.call_type, resolved: !!c.symbol_id })));
  });

  it("should compare Python (working) vs TypeScript (failing)", async () => {
    // Run Python scenario
    console.log("\n========== PYTHON (WORKING) ==========");
    project.update_file("user_class.py" as FilePath, `
class User:
    def get_name(self):
        return "Alice"
    `);

    project.update_file("uses_user.py" as FilePath, `
from .user_class import User

user = User()
user_name = user.get_name()
    `);

    const python_index = project.get_semantic_index("uses_user.py" as FilePath)!;
    const python_refs = python_index.references;
    const python_bindings = extract_constructor_bindings(python_refs);

    console.log("Python constructor bindings:", python_bindings.size);
    for (const [loc_key, type_name] of python_bindings) {
      console.log(`  - ${loc_key} → ${type_name}`);
    }

    // Run TypeScript scenario
    console.log("\n========== TYPESCRIPT (FAILING) ==========");
    project.update_file("types2.ts" as FilePath, `
export class User {
  getName() { return "Alice"; }
}
    `);

    project.update_file("main2.ts" as FilePath, `
import { User } from "./types2";
const user = new User();
const name = user.getName();
    `);

    const ts_index = project.get_semantic_index("main2.ts" as FilePath)!;
    const ts_refs = ts_index.references;
    const ts_bindings = extract_constructor_bindings(ts_refs);

    console.log("TypeScript constructor bindings:", ts_bindings.size);
    for (const [loc_key, type_name] of ts_bindings) {
      console.log(`  - ${loc_key} → ${type_name}`);
    }

    // Compare side-by-side
    console.log("\n========== COMPARISON ==========");
    console.log("Python bindings:", python_bindings.size);
    console.log("TypeScript bindings:", ts_bindings.size);
    console.log("Difference:", ts_bindings.size - python_bindings.size);
  });
});
