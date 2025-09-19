# Task: Type Flow References Split

**Task ID**: task-epic-11.90.6
**Parent**: task-epic-11.90
**Status**: Created
**Priority**: High
**Created**: 2024-01-19
**Estimated Effort**: 5 hours
**Phase**: 6 - Type Flow References Split

## Objective

Split the `semantic_index/references/type_flow_references` module into:
1. **Assignment tracking** (stays in semantic_index): Track assignment patterns only
2. **Type flow analysis** (moves to symbol_resolution): Resolve types through assignments

## Background

The type_flow_references module currently attempts to:
- Resolve constructor types before classes are resolved
- Track types through function returns (needs resolved signatures)
- Build type propagation graphs
- Infer types through assignment chains

These operations require cross-file type information not available during the semantic_index phase.

## Implementation

### 1. Simplify type_flow_references in Semantic Index

Update `packages/core/src/semantic_index/references/type_flow_references/type_flow_references.ts`:

```typescript
/**
 * Type Flow References - Local assignment tracking only
 *
 * Tracks assignment patterns and flow relationships without
 * attempting to resolve or propagate types.
 */

export interface LocalTypeFlow {
  /** Constructor calls found in code */
  readonly constructor_calls: LocalConstructorCall[];

  /** Assignment flows between variables */
  readonly assignments: LocalAssignmentFlow[];

  /** Return statements and their values */
  readonly returns: LocalReturnFlow[];

  /** Function call results assigned to variables */
  readonly call_assignments: LocalCallAssignment[];
}

export interface LocalConstructorCall {
  /** Constructor name (unresolved) */
  readonly class_name: SymbolName;

  /** Location of the new expression */
  readonly location: Location;

  /** Target variable if assigned */
  readonly assigned_to?: SymbolName;

  /** Arguments passed (for signature matching later) */
  readonly argument_count: number;

  /** Containing scope */
  readonly scope_id: ScopeId;
}

export interface LocalAssignmentFlow {
  /** Source variable or expression */
  readonly source: FlowSource;

  /** Target variable */
  readonly target: SymbolName;

  /** Assignment location */
  readonly location: Location;

  /** Assignment kind */
  readonly kind: "direct" | "destructured" | "spread";
}

export interface LocalReturnFlow {
  /** Function containing the return */
  readonly function_name?: SymbolName;

  /** Return statement location */
  readonly location: Location;

  /** Returned expression info */
  readonly value: FlowSource;

  /** Containing scope */
  readonly scope_id: ScopeId;
}

export interface LocalCallAssignment {
  /** Function being called (unresolved) */
  readonly function_name: SymbolName;

  /** Call location */
  readonly location: Location;

  /** Variable receiving the result */
  readonly assigned_to: SymbolName;

  /** Method call info if applicable */
  readonly method_info?: {
    readonly object_name: SymbolName;
    readonly method_name: SymbolName;
  };
}

export type FlowSource =
  | { kind: "variable"; name: SymbolName }
  | { kind: "literal"; value: string; literal_type: "string" | "number" | "boolean" }
  | { kind: "constructor"; class_name: SymbolName }
  | { kind: "function_call"; function_name: SymbolName }
  | { kind: "expression"; text: string };

/**
 * Extract type flow patterns without resolution
 */
export function extract_type_flow(
  captures: NormalizedCapture[],
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): LocalTypeFlow {
  const constructor_calls: LocalConstructorCall[] = [];
  const assignments: LocalAssignmentFlow[] = [];
  const returns: LocalReturnFlow[] = [];
  const call_assignments: LocalCallAssignment[] = [];

  for (const capture of captures) {
    switch (capture.category) {
      case SemanticCategory.CONSTRUCTOR_CALL:
        // Just track the call, don't resolve the type
        constructor_calls.push({
          class_name: extract_class_name(capture),
          location: capture.node_location,
          assigned_to: extract_assignment_target(capture),
          argument_count: count_arguments(capture),
          scope_id: find_containing_scope(capture, scopes),
        });
        break;

      case SemanticCategory.ASSIGNMENT:
        assignments.push(extract_assignment_flow(capture));
        break;

      case SemanticCategory.RETURN_STATEMENT:
        returns.push(extract_return_flow(capture, scopes));
        break;

      case SemanticCategory.FUNCTION_CALL:
        if (has_assignment_target(capture)) {
          call_assignments.push(extract_call_assignment(capture));
        }
        break;
    }
  }

  return { constructor_calls, assignments, returns, call_assignments };
}
```

### 2. Remove Resolution Logic

Delete these functions from type_flow_references:
- `resolve_constructor_type()` - Needs resolved class types
- `propagate_types()` - Requires TypeIds
- `infer_return_type()` - Needs resolved function signatures
- `build_flow_graph()` - Works with resolved types
- `track_type_through_calls()` - Needs resolved signatures

### 3. Create Type Flow Analysis in Symbol Resolution

Create `packages/core/src/symbol_resolution/type_resolution/type_flow.ts`:

```typescript
/**
 * Type Flow Analysis - Phase 3
 *
 * Analyzes type flow through assignments, returns, and calls
 * using fully resolved type information.
 */

import type { TypeId, SymbolId, Location, FilePath } from "@ariadnejs/types";
import type { LocalTypeFlow } from "../../semantic_index/references/type_flow_references";
import type { ImportResolutionMap, FunctionResolutionMap, TypeRegistry } from "../types";

export interface ResolvedTypeFlow {
  /** Type flow graph with resolved types */
  readonly flow_graph: TypeFlowGraph;

  /** Constructor to type mappings */
  readonly constructor_types: Map<Location, TypeId>;

  /** Variable type assignments from flow */
  readonly inferred_types: Map<SymbolId, TypeId>;

  /** Return type inference */
  readonly return_types: Map<SymbolId, TypeId>;
}

export class TypeFlowGraph {
  private edges: Map<FlowNode, Set<FlowNode>> = new Map();
  private node_types: Map<FlowNode, TypeId> = new Map();

  addFlow(source: FlowNode, target: FlowNode, type: TypeId): void {
    if (!this.edges.has(source)) {
      this.edges.set(source, new Set());
    }
    this.edges.get(source)!.add(target);
    this.node_types.set(source, type);
  }

  propagateTypes(): Map<FlowNode, TypeId> {
    // Propagate types through the flow graph
    const result = new Map<FlowNode, TypeId>();
    // ... propagation algorithm
    return result;
  }
}

/**
 * Analyze type flow with resolved context
 */
export function analyze_type_flow(
  local_flows: Map<FilePath, LocalTypeFlow>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeRegistry
): ResolvedTypeFlow {
  const flow_graph = new TypeFlowGraph();
  const constructor_types = new Map<Location, TypeId>();
  const inferred_types = new Map<SymbolId, TypeId>();
  const return_types = new Map<SymbolId, TypeId>();

  // Phase 1: Resolve constructor calls
  for (const [file_path, flow] of local_flows) {
    for (const constructor of flow.constructor_calls) {
      const type_id = resolve_constructor_type(
        constructor.class_name,
        file_path,
        imports,
        types
      );

      if (type_id) {
        constructor_types.set(constructor.location, type_id);

        if (constructor.assigned_to) {
          const var_symbol = variable_symbol(
            constructor.assigned_to,
            file_path,
            constructor.location
          );
          inferred_types.set(var_symbol, type_id);

          // Add to flow graph
          const source_node: FlowNode = { kind: "constructor", location: constructor.location };
          const target_node: FlowNode = { kind: "variable", symbol: var_symbol };
          flow_graph.addFlow(source_node, target_node, type_id);
        }
      }
    }
  }

  // Phase 2: Track assignments
  for (const [file_path, flow] of local_flows) {
    for (const assignment of flow.assignments) {
      const source_type = resolve_source_type(
        assignment.source,
        file_path,
        inferred_types,
        functions,
        types
      );

      if (source_type) {
        const target_symbol = variable_symbol(
          assignment.target,
          file_path,
          assignment.location
        );
        inferred_types.set(target_symbol, source_type);

        // Add to flow graph
        const source_node = create_flow_node(assignment.source, file_path);
        const target_node: FlowNode = { kind: "variable", symbol: target_symbol };
        flow_graph.addFlow(source_node, target_node, source_type);
      }
    }
  }

  // Phase 3: Resolve function returns
  for (const [file_path, flow] of local_flows) {
    for (const return_stmt of flow.returns) {
      const return_type = resolve_source_type(
        return_stmt.value,
        file_path,
        inferred_types,
        functions,
        types
      );

      if (return_type && return_stmt.function_name) {
        const func_symbol = function_symbol(
          return_stmt.function_name,
          file_path,
          return_stmt.location
        );

        // Merge with existing return type if multiple returns
        const existing = return_types.get(func_symbol);
        if (existing && existing !== return_type) {
          // Handle union types
          return_types.set(func_symbol, create_union_type(existing, return_type));
        } else {
          return_types.set(func_symbol, return_type);
        }
      }
    }
  }

  // Phase 4: Propagate types through the graph
  const propagated = flow_graph.propagateTypes();
  for (const [node, type] of propagated) {
    if (node.kind === "variable") {
      inferred_types.set(node.symbol, type);
    }
  }

  return { flow_graph, constructor_types, inferred_types, return_types };
}

/**
 * Resolve a constructor call to its type
 */
function resolve_constructor_type(
  class_name: SymbolName,
  file_path: FilePath,
  imports: ImportResolutionMap,
  types: TypeRegistry
): TypeId | undefined {
  // First check local types
  const local_type = types.type_names.get(file_path)?.get(class_name);
  if (local_type) return local_type;

  // Then check imports
  const import_info = imports.get(file_path)?.get(class_name);
  if (import_info?.resolved_location) {
    return types.findTypeByLocation(import_info.resolved_location);
  }

  return undefined;
}
```

### 4. Update Tests

#### Semantic Index Tests (Local Only)

```typescript
describe("extract_type_flow", () => {
  it("should track constructor calls without resolution", () => {
    const code = `
      const obj = new MyClass();
      const result = someFunction();
    `;

    const flow = extract_type_flow(captures, scopes, filePath);

    // Should track the constructor call
    expect(flow.constructor_calls[0].class_name).toBe("MyClass");
    expect(flow.constructor_calls[0].assigned_to).toBe("obj");

    // Should track the function call assignment
    expect(flow.call_assignments[0].function_name).toBe("someFunction");
    expect(flow.call_assignments[0].assigned_to).toBe("result");

    // No type resolution
    expect(flow.resolved_types).toBeUndefined();
  });
});
```

#### Symbol Resolution Tests (With Resolution)

```typescript
describe("analyze_type_flow", () => {
  it("should resolve constructor types", () => {
    const local_flows = create_mock_flows();
    const imports = create_resolved_imports();
    const types = create_type_registry();

    const resolved = analyze_type_flow(local_flows, imports, functions, types);

    // Should have resolved constructor type
    const obj_type = resolved.inferred_types.get(variable_symbol("obj"));
    expect(obj_type).toBe("class:MyClass:file.ts:1:0");
  });

  it("should propagate types through assignments", () => {
    const code_flow = {
      assignments: [
        { source: { kind: "variable", name: "a" }, target: "b" },
        { source: { kind: "variable", name: "b" }, target: "c" },
      ],
    };

    const resolved = analyze_type_flow(flows, imports, functions, types);

    // Type should propagate from a -> b -> c
    const c_type = resolved.inferred_types.get(variable_symbol("c"));
    expect(c_type).toBe(a_type);
  });
});
```

## Success Criteria

1. ✅ Type flow extraction captures patterns without resolution
2. ✅ No TypeId generation in semantic_index
3. ✅ Constructor resolution moved to symbol_resolution
4. ✅ Type propagation works with resolved types
5. ✅ Return type inference uses resolved signatures
6. ✅ Flow graph properly tracks type propagation

## Dependencies

- **Depends on**:
  - task-epic-11.90.1: Infrastructure
  - task-epic-11.90.3: Type registry
  - task-epic-11.90.4: Type resolution
  - task-epic-11.90.5: Type tracking
- **Blocks**:
  - Accurate method call resolution
  - Type inference features

## Risks and Mitigations

### Risk 1: Complex Flow Analysis
**Mitigation**: Start with simple direct flows, add complexity gradually

### Risk 2: Performance with Large Graphs
**Mitigation**: Implement incremental propagation, cache results

## Next Steps

After this task:
- Phase 7: Type annotation references split (already documented)
- Phase 8: Integration testing

## Notes

Type flow analysis is one of the most complex parts of type resolution. It requires:
- Resolved constructor-to-type mappings
- Resolved function return types
- Complete type registry
- Import resolution

This is why it must happen in Phase 3 of symbol resolution, after all the prerequisites are available.