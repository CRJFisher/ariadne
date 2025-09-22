# Task: Implement Function Call Resolution

**Task ID**: task-epic-11.91.2
**Parent**: task-epic-11.91
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Completed**: 2025-01-22
**Estimated Effort**: 2-3 days

## Sub-Tasks

1. **task-epic-11.91.2.1**: Lexical scope resolution infrastructure (1-1.5 days) ✅ **Completed**
2. **task-epic-11.91.2.2**: Function call resolution with import integration (1-1.5 days) ✅ **Completed**

## Problem Statement

Phase 2 of the symbol resolution pipeline is currently unimplemented, preventing direct function call resolution. Function call resolution is essential for building accurate call graphs and requires lexical scope analysis combined with import resolution.

### Current State

```typescript
// symbol_resolution.ts - Phase 2 is a stub
function phase2_resolve_functions(
  _indices: ReadonlyMap<FilePath, SemanticIndex>,
  _imports: ImportResolutionMap
): FunctionResolutionMap {
  const function_calls = new Map<Location, SymbolId>();
  const calls_to_function = new Map<SymbolId, Location[]>();
  // TODO: Implementation
  return { function_calls, calls_to_function };
}
```

The semantic_index extracts CallReference data, but we need to resolve these calls to their actual function definitions.

## Solution Overview

Implement function call resolution using lexical scoping rules, integrated with import resolution from Phase 1. This enables accurate mapping of function calls to their definitions across file boundaries.

### Architecture

```
symbol_resolution/
├── function_resolution/
│   ├── index.ts              # Public API
│   ├── function_resolver.ts  # Main resolution logic
│   ├── scope_walker.ts       # Lexical scope traversal
│   ├── hoisting_handler.ts   # Language-specific hoisting
│   ├── function_types.ts     # Type definitions
│   └── language_handlers/    # Language-specific resolution
│       ├── javascript.ts     # JS/TS function resolution
│       ├── python.ts         # Python function resolution
│       └── rust.ts           # Rust function resolution
```

## Implementation Plan

### 1. Core Infrastructure

**Module**: `function_resolution/function_types.ts`

Define resolution data structures:

```typescript
interface FunctionCallResolution {
  call_location: Location;
  resolved_function: SymbolId;
  resolution_method: "lexical" | "imported" | "global" | "builtin";
  scope_chain: ScopeId[];
}

interface ResolutionContext {
  current_scope: LexicalScope;
  scopes: Map<ScopeId, LexicalScope>;
  imports: Map<SymbolName, SymbolId>;
  symbols: Map<SymbolId, SymbolDefinition>;
}
```

### 2. Lexical Scope Walking

**Module**: `function_resolution/scope_walker.ts`

Implement scope chain traversal for function resolution:

```typescript
function resolve_in_scope_chain(
  function_name: SymbolName,
  starting_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  symbols: Map<SymbolId, SymbolDefinition>
): SymbolId | null {
  let current_scope: LexicalScope | undefined = starting_scope;
  const visited = new Set<ScopeId>();

  while (current_scope && !visited.has(current_scope.id)) {
    visited.add(current_scope.id);

    // Check for function definition in current scope
    const function_symbol = find_function_in_scope(
      function_name,
      current_scope,
      symbols
    );

    if (function_symbol) {
      return function_symbol;
    }

    // Move to parent scope
    current_scope = current_scope.parent_id
      ? scopes.get(current_scope.parent_id)
      : undefined;
  }

  return null;
}
```

### 3. Hoisting Handling

**Module**: `function_resolution/hoisting_handler.ts`

Handle language-specific hoisting semantics:

**JavaScript/TypeScript**:
- Function declarations hoisted to function scope
- `var` declarations hoisted (but not initialization)
- `let`/`const` in temporal dead zone

**Python**:
- No hoisting - strict definition before use
- Function definitions available after declaration

**Rust**:
- Items (functions, structs) available throughout module
- Local variables follow block scoping

### 4. Function Call Resolution Algorithm

**Module**: `function_resolution/function_resolver.ts`

**⚠️ Critical**: Use `LocationKey` instead of `Location` for map keys to ensure proper equality comparison.

Core resolution logic:

```typescript
function resolve_function_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): FunctionResolutionMap {
  const function_calls = new Map<LocationKey, SymbolId>();
  const calls_to_function = new Map<SymbolId, Location[]>();

  for (const [file_path, index] of indices) {
    const file_imports = imports.imports.get(file_path) || new Map();

    // Process all call references in this file
    for (const call_ref of index.references.calls) {
      if (call_ref.call_type === "function") {
        const resolved_function = resolve_function_call(
          call_ref,
          index,
          file_imports
        );

        if (resolved_function) {
          function_calls.set(location_key(call_ref.location), resolved_function);

          // Update reverse mapping
          const call_locations = calls_to_function.get(resolved_function) || [];
          call_locations.push(call_ref.location);
          calls_to_function.set(resolved_function, call_locations);
        }
      }
    }
  }

  return { function_calls, calls_to_function };
}
```

### 5. Resolution Priority Order

For each function call, attempt resolution in this order:

1. **Lexical Scope Resolution**: Walk up scope chain
2. **Imported Symbol Resolution**: Check import mappings
3. **Global/Builtin Resolution**: Language-specific globals
4. **Unresolved**: Mark as unresolved with reason

```typescript
function resolve_function_call(
  call_ref: CallReference,
  index: SemanticIndex,
  imports: Map<SymbolName, SymbolId>
): SymbolId | null {
  const function_name = call_ref.name;

  // 1. Try lexical scope resolution
  const scope = index.scopes.get(call_ref.scope_id);
  if (scope) {
    const lexical_result = resolve_in_scope_chain(
      function_name,
      scope,
      index.scopes,
      index.symbols
    );
    if (lexical_result) return lexical_result;
  }

  // 2. Try imported symbol resolution
  const imported_symbol = imports.get(function_name);
  if (imported_symbol) return imported_symbol;

  // 3. Try global/builtin resolution
  const global_symbol = resolve_global_function(function_name, index.language);
  if (global_symbol) return global_symbol;

  // 4. Unresolved
  return null;
}
```

## Language-Specific Implementations

### JavaScript/TypeScript

**Module**: `language_handlers/javascript.ts`

- Handle function declarations and expressions
- Arrow functions and method shorthand
- Built-in functions (setTimeout, fetch, etc.)
- Node.js globals (require, process, etc.)

### Python

**Module**: `language_handlers/python.ts`

- Function definitions with `def`
- Lambda expressions
- Built-in functions (print, len, etc.)
- Method resolution (handled in Phase 4)

### Rust

**Module**: `language_handlers/rust.ts`

- Function definitions with `fn`
- Closures and function pointers
- Standard library functions
- Trait method calls (handled in Phase 4)

## Integration Points

### With Phase 1 (Import Resolution)

```typescript
function phase2_resolve_functions(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): FunctionResolutionMap {
  return resolve_function_calls(indices, imports);
}
```

### With Phase 4 (Method Resolution)

Function resolution provides foundation for method resolution:
- Resolved function signatures help with method overloading
- Function call patterns inform method call analysis

### With Semantic Index

Use existing call extraction from semantic_index:

```typescript
// Already available in ProcessedReferences
interface ProcessedReferences {
  readonly calls: readonly CallReference[];
}
```

## Testing Strategy

### Unit Tests

- Lexical scope resolution for nested functions
- Import-based function resolution
- Hoisting behavior verification
- Global/builtin function resolution

### Integration Tests

- Cross-file function calls
- Complex scope scenarios (closures, nested functions)
- Performance tests on large codebases
- Multi-language function resolution

### Test Fixtures

```
fixtures/
├── javascript/
│   ├── hoisting/
│   ├── closures/
│   ├── arrow_functions/
│   └── cross_file_calls/
├── typescript/
│   ├── function_overloads/
│   └── generic_functions/
├── python/
│   ├── nested_functions/
│   ├── decorators/
│   └── lambda_expressions/
└── rust/
    ├── function_pointers/
    ├── closures/
    └── trait_functions/
```

## Performance Considerations

### Optimization Strategies

1. **Scope Cache**: Cache scope lookup results
2. **Import Cache**: Cache import resolution for repeated names
3. **Symbol Index**: Pre-build symbol name indices
4. **Incremental Resolution**: Only re-resolve changed files

### Memory Management

- Use weak references where appropriate
- Implement cleanup for large projects
- Consider memory usage of reverse mappings

## Success Criteria

1. **Accurate Resolution**: Function calls correctly mapped to definitions
2. **Lexical Scope Compliance**: Follows language-specific scoping rules
3. **Import Integration**: Works with Phase 1 import resolution
4. **Multi-Language Support**: Handles JavaScript, TypeScript, Python, Rust
5. **Performance**: Efficient resolution for large codebases
6. **Error Handling**: Graceful handling of unresolvable calls

## Dependencies

- **Prerequisite**: task-epic-11.91.1 (Import resolution) - must be completed first
- **Prerequisite**: Semantic index call extraction (✅ available)
- **Sub-task dependencies**:
  - task-epic-11.91.2.1 (Scope infrastructure) can start independently
  - task-epic-11.91.2.2 (Function resolution) requires both 11.91.2.1 and 11.91.1 complete
- **Enables**: task-epic-11.91.3 (Method resolution can build on function resolution patterns)
- **Enables**: Complete symbol resolution pipeline

## Risks and Mitigations

### Risk 1: Complex Scoping Rules

Language scoping rules are complex and language-specific.

**Mitigation**: Implement language handlers separately, extensive testing with edge cases.

### Risk 2: Performance Impact

Scope walking can be expensive for deeply nested code.

**Mitigation**: Implement caching and optimize scope traversal algorithms.

### Risk 3: Dynamic Function Calls

Some function calls cannot be resolved statically (dynamic calls).

**Mitigation**: Mark unresolvable calls with reasons, support optional dynamic analysis.

## Implementation Notes

- Reuse existing scope_tree infrastructure from semantic_index
- Follow functional programming patterns
- Use branded types for type safety
- Include comprehensive logging for debugging
- Document resolution decisions for each call

## References

- JavaScript lexical scoping specification
- Python scope and namespace documentation
- Rust ownership and borrowing guide
- Existing scope_tree implementation in semantic_index