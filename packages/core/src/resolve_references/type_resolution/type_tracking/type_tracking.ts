/**
 * Type Tracking Resolution - Phase 3
 *
 * Resolves variable types using full cross-file context.
 */

import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import type { LocalTypeTracking } from "../../../index_single_file/references/type_tracking";
import type { GlobalTypeRegistry } from "../types";

/**
 * Resolved type tracking with full cross-file context
 */
export interface ResolvedTypeTracking {
  /** Variable to type mappings */
  readonly variable_types: Map<SymbolId, TypeId>;

  /** Location to type mappings for all expressions */
  readonly expression_types: Map<Location, TypeId>;

  /** Type flow graph */
  readonly type_flows: TypeFlowGraph;
}

/**
 * Type flow graph tracking type changes through assignments
 */
export interface TypeFlowGraph {
  /** Map from variable to all its type states */
  readonly flows: Map<SymbolId, TypeFlowEdge[]>;
}

/**
 * Edge in type flow graph
 */
export interface TypeFlowEdge {
  /** Source type before assignment */
  readonly from_type?: TypeId;

  /** Target type after assignment */
  readonly to_type: TypeId;

  /** Location of the assignment */
  readonly location: Location;

  /** Kind of flow */
  readonly kind: "initialization" | "assignment" | "narrowing" | "widening";
}

/**
 * Resolve all type tracking with full context
 */
export function resolve_type_tracking(
  local_tracking: Map<FilePath, LocalTypeTracking>,
  type_registry: GlobalTypeRegistry
): ResolvedTypeTracking {
  const variable_types = new Map<SymbolId, TypeId>();
  const expression_types = new Map<Location, TypeId>();
  const type_flows: TypeFlowGraph = { flows: new Map() };

  // Track the declaration location for each variable name in each file
  // This ensures consistent SymbolIds for the same variable
  const variable_declarations = new Map<FilePath, Map<SymbolName, Location>>();

  // Phase 1: Resolve explicit annotations
  for (const [file_path, tracking] of local_tracking) {
    for (const annotation of tracking.annotations) {
      const type_id = resolve_annotation_to_type(
        annotation.annotation_text,
        file_path,
        type_registry
      );

      if (type_id) {
        const symbol_id = variable_symbol(annotation.name, annotation.location);
        variable_types.set(symbol_id, type_id);
        expression_types.set(annotation.location, type_id);
      }
    }
  }

  // Phase 2: Infer types from initializers
  for (const [file_path, tracking] of local_tracking) {
    // First, collect all declaration locations
    const file_vars = variable_declarations.get(file_path) || new Map();
    for (const declaration of tracking.declarations) {
      file_vars.set(declaration.name, declaration.location);
    }
    variable_declarations.set(file_path, file_vars);

    for (const declaration of tracking.declarations) {
      // Skip if already has type annotation
      if (declaration.type_annotation) {
        const type_id = resolve_annotation_to_type(
          declaration.type_annotation,
          file_path,
          type_registry
        );

        if (type_id) {
          const symbol_id = variable_symbol(
            declaration.name,
            declaration.location
          );
          variable_types.set(symbol_id, type_id);
        }
      } else if (declaration.initializer) {
        const inferred_type = infer_type_from_initializer(
          declaration.initializer,
          file_path,
          variable_types,
          type_registry
        );

        if (inferred_type) {
          const symbol_id = variable_symbol(
            declaration.name,
            declaration.location
          );
          variable_types.set(symbol_id, inferred_type);

          // Add to type flow
          const edges = type_flows.flows.get(symbol_id) || [];
          edges.push({
            to_type: inferred_type,
            location: declaration.location,
            kind: "initialization",
          });
          type_flows.flows.set(symbol_id, edges);
        }
      }
    }
  }

  // Phase 3: Track type flow through assignments
  for (const [file_path, tracking] of local_tracking) {
    for (const assignment of tracking.assignments) {
      // Use the declaration location to get consistent SymbolId
      const file_vars = variable_declarations.get(file_path);
      const decl_location = file_vars?.get(assignment.target);
      if (!decl_location) {
        // Variable not declared, skip
        continue;
      }

      const symbol_id = variable_symbol(assignment.target, decl_location);

      const current_type = variable_types.get(symbol_id);
      const source_type = infer_type_from_initializer(
        assignment.source,
        file_path,
        variable_types,
        type_registry
      );

      if (source_type) {
        // Track flow edge
        const edges = type_flows.flows.get(symbol_id) || [];
        edges.push({
          from_type: current_type,
          to_type: source_type,
          location: assignment.location,
          kind: "assignment",
        });
        type_flows.flows.set(symbol_id, edges);

        // Update variable type
        variable_types.set(symbol_id, source_type);
      }
    }
  }

  return { variable_types, expression_types, type_flows };
}

/**
 * Resolve an annotation string to a TypeId
 */
function resolve_annotation_to_type(
  annotation: string,
  file_path: FilePath,
  registry: GlobalTypeRegistry
): TypeId | undefined {
  // Parse the annotation string to extract base type and generics
  const parsed = parse_type_annotation(annotation);

  // Try to resolve as built-in type first
  const builtin_type = resolve_builtin_type(parsed.base);
  if (builtin_type) {
    return builtin_type;
  }

  // Look up in type registry - first check file-specific types, then global
  const file_types = registry.type_names.get(file_path);
  if (file_types) {
    const type_id = file_types.get(parsed.base as SymbolName);
    if (type_id) {
      return type_id;
    }
  }

  // Check all types globally
  for (const [_, file_type_map] of registry.type_names) {
    const type_id = file_type_map.get(parsed.base as SymbolName);
    if (type_id) {
      return type_id;
    }
  }

  // Generic type resolution requires additional type parameter handling
  // Return undefined for unresolved types
  return undefined;
}

/**
 * Parse a type annotation string
 */
function parse_type_annotation(annotation: string): {
  base: string;
  generics?: string[];
} {
  // Remove whitespace
  annotation = annotation.trim();

  // Check for generic syntax like Array<string> or Map<string, number>
  const generic_match = annotation.match(/^([^<]+)<(.+)>$/);
  if (generic_match) {
    const base = generic_match[1].trim();
    const generics_str = generic_match[2];

    // Parse generic arguments (handle nested generics later)
    const generics = generics_str.split(",").map((g) => g.trim());

    return { base, generics };
  }

  // Check for array syntax like string[]
  if (annotation.endsWith("[]")) {
    return {
      base: "Array",
      generics: [annotation.slice(0, -2)],
    };
  }

  // Simple type
  return { base: annotation };
}

/**
 * Resolve built-in type names to TypeIds
 */
function resolve_builtin_type(type_name: string): TypeId | undefined {
  const builtins: Record<string, TypeId> = {
    string: "builtin:string" as TypeId,
    number: "builtin:number" as TypeId,
    boolean: "builtin:boolean" as TypeId,
    void: "builtin:void" as TypeId,
    any: "builtin:any" as TypeId,
    unknown: "builtin:unknown" as TypeId,
    never: "builtin:never" as TypeId,
    null: "builtin:null" as TypeId,
    undefined: "builtin:undefined" as TypeId,
    object: "builtin:object" as TypeId,
    Function: "builtin:Function" as TypeId,
    Array: "builtin:Array" as TypeId,
    Map: "builtin:Map" as TypeId,
    Set: "builtin:Set" as TypeId,
    Promise: "builtin:Promise" as TypeId,
  };

  return builtins[type_name];
}

/**
 * Infer type from an initializer expression
 */
function infer_type_from_initializer(
  initializer: string,
  file_path: FilePath,
  variable_types: Map<SymbolId, TypeId>,
  registry: GlobalTypeRegistry
): TypeId | undefined {
  // Check for string literals
  if (
    initializer.startsWith('"') ||
    initializer.startsWith("'") ||
    initializer.startsWith("`")
  ) {
    return "builtin:string" as TypeId;
  }

  // Check for numeric literals
  if (/^\d+(\.\d+)?$/.test(initializer)) {
    return "builtin:number" as TypeId;
  }

  // Check for boolean literals
  if (initializer === "true" || initializer === "false") {
    return "builtin:boolean" as TypeId;
  }

  // Check for null/undefined
  if (initializer === "null") {
    return "builtin:null" as TypeId;
  }

  if (initializer === "undefined") {
    return "builtin:undefined" as TypeId;
  }

  // Check for constructor calls (new ClassName())
  const ctor_match = initializer.match(/^new\s+([A-Z]\w+)/);
  if (ctor_match) {
    const class_name = ctor_match[1] as SymbolName;

    // Look up in type registry - first check file-specific types
    const file_types = registry.type_names.get(file_path);
    if (file_types) {
      const type_id = file_types.get(class_name);
      if (type_id) {
        return type_id;
      }
    }

    // Check globally
    for (const [_, file_type_map] of registry.type_names) {
      const type_id = file_type_map.get(class_name);
      if (type_id) {
        return type_id;
      }
    }
  }

  // Check for array literals
  if (initializer.startsWith("[")) {
    return "builtin:Array" as TypeId;
  }

  // Check for object literals
  if (initializer.startsWith("{")) {
    return "builtin:object" as TypeId;
  }

  // Could be a variable reference - look it up
  const var_id = variable_symbol(initializer as SymbolName, {
    file_path,
    line: 0,
    column: 0,
    end_line: 0,
    end_column: 0,
  });
  const var_type = variable_types.get(var_id);
  if (var_type) {
    return var_type;
  }

  // Unable to infer type
  return undefined;
}
