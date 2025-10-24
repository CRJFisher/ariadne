---
id: task-158
title: Add Module-Level Code as Callable Definition Type for Call Graph Detection
status: To Do
assignee: []
created_date: '2025-10-24 15:52'
labels:
  - architecture
  - call-graph
  - modules
  - entry-points
dependencies: []
priority: medium
---

## Description

Extend the `CallableDefinition` type to include module-level code as a first-class callable in call graph detection. In Python, JavaScript, TypeScript, and other languages, module-level code is executed automatically when the module is imported, making the module itself a special kind of "callable" that is invoked by import statements.

## Core Architectural Insight

This task addresses a fundamental asymmetry in our current call graph model:

**Regular callables** (functions, methods, constructors):

- Are **referenced** by call expressions (CallReference)
- The reference invokes the callable

**Modules** (module-level executable code):

- Are **referenced** by import statements (ImportDefinition)
- The import "invokes" the module's top-level code
- Import statements are **definitions**, not references

This creates a unique situation: modules are "called" by definitions (imports), not by references (call expressions).

## Background

### Current State

Currently, `CallableDefinition` only includes:

```typescript
export type CallableDefinition =
  | FunctionDefinition
  | MethodDefinition
  | ConstructorDefinition;
```

Call graph detection in [detect_call_graph.ts](../../../packages/core/src/trace_call_graph/detect_call_graph.ts:1-91) operates on these callable types:

1. `build_function_nodes()` creates nodes for each callable
2. `detect_entry_points()` finds callables that are never referenced

### The Module Problem

Module-level code executes when imported:

**Python:**

```python
# my_module.py
print("This runs on import!")

def setup():
    """This runs only when explicitly called"""
    pass

# This also runs on import
setup()
```

**JavaScript/TypeScript:**

```javascript
// my_module.js
console.log("This runs on import!");

function setup() {
  // This runs only when explicitly called
}

// This also runs on import
setup();
```

**Implications:**

1. Module-level code forms an implicit callable
2. Import statements form implicit "call sites"
3. Modules that are never imported are entry points (like functions never called)
4. Module initialization code participates in call graphs

## Why This Matters for Call Graph Detection

### Entry Point Detection

Currently, entry points are "functions never called by other functions". But we're missing:

- **Modules never imported** are also entry points (script files, test files)
- Module-level code can call functions, making those functions non-entry-points

### Call Graph Completeness

Without tracking module-level code:

1. We miss module initialization as a caller
2. We can't trace calls made during import
3. We can't detect import-order dependencies
4. Entry point detection is incomplete

### Example Scenario

```typescript
// logger.ts
console.log("Logger initializing...");
export const logger = createLogger(); // createLogger() called at import time

// app.ts
import { logger } from './logger'; // Triggers logger.ts execution
logger.info("App started");
```

Current behavior: `createLogger()` appears to be called by no one
Correct behavior: `createLogger()` is called by logger.ts module initialization

## Proposed Solution

### 1. Add ModuleDefinition Type

```typescript
export interface ModuleDefinition extends BaseDefinition {
  kind: "module";
  name: string; // Module name/path
  file_path: string;
  body_scope_id: ScopeId; // The module's top-level scope
  location: Location;
  export?: ExportDefinition;
}
```

### 2. Update CallableDefinition

```typescript
export type CallableDefinition =
  | FunctionDefinition
  | MethodDefinition
  | ConstructorDefinition
  | ModuleDefinition; // NEW
```

### 3. Track Module "Invocations"

Create a new relationship type to track when imports invoke modules:

```typescript
export interface ModuleInvocation {
  // The import statement that triggers the module
  import_definition: ImportDefinition;

  // The module being invoked
  module_symbol_id: SymbolId;

  // Location of the import
  location: Location;
}
```

### 4. Update Call Graph Detection

Modify [detect_call_graph.ts](../../../packages/core/src/trace_call_graph/detect_call_graph.ts:1-91):

```typescript
function build_callable_nodes(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): ReadonlyMap<SymbolId, CallableNode> {
  const nodes = new Map<SymbolId, CallableNode>();

  const callable_defs = definitions.get_callable_definitions();

  for (const callable_def of callable_defs) {
    // Handle modules differently
    if (callable_def.kind === "module") {
      const module_calls = resolutions.get_calls_by_caller_scope(
        callable_def.body_scope_id
      );

      nodes.set(callable_def.symbol_id, {
        symbol_id: callable_def.symbol_id,
        name: callable_def.name,
        enclosed_calls: module_calls,
        location: callable_def.location,
        definition: callable_def,
      });
    } else {
      // Existing function/method/constructor handling
      // ...
    }
  }

  return nodes;
}

function detect_entry_points(
  nodes: ReadonlyMap<SymbolId, CallableNode>,
  resolutions: ResolutionRegistry,
  definitions: DefinitionRegistry
): SymbolId[] {
  const called_symbols = resolutions.get_all_referenced_symbols();

  // NEW: Get all modules that are imported
  const imported_modules = definitions.get_imported_module_symbols();

  const entry_points: SymbolId[] = [];

  for (const [symbol_id, node] of nodes.entries()) {
    if (node.definition.kind === "module") {
      // Module is an entry point if it's never imported
      if (!imported_modules.has(symbol_id)) {
        entry_points.push(symbol_id);
      }
    } else {
      // Function/method/constructor is an entry point if never called
      if (!called_symbols.has(symbol_id)) {
        entry_points.push(symbol_id);
      }
    }
  }

  return entry_points;
}
```

## Implementation Steps

### Phase 1: Type System (Core Types)

- [ ] Add `ModuleDefinition` interface to [symbol_definitions.ts](../../../packages/types/src/symbol_definitions.ts:1-250)
- [ ] Update `CallableDefinition` union type
- [ ] Add `module_symbol()` factory function to [symbol.ts](../../../packages/types/src/symbol.ts)
- [ ] Add type guards: `is_module()`, `is_callable_definition()`
- [ ] Update `AnyDefinition` union type

### Phase 2: Semantic Index (Module Extraction)

For each language, extract module-level scope as a ModuleDefinition:

- [ ] **TypeScript**: Extract module scope in [typescript_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts)
  - Root scope becomes module definition
  - Handle ES modules, CommonJS

- [ ] **JavaScript**: Extract module scope in [javascript_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts)
  - Root scope becomes module definition
  - Handle ES modules, CommonJS, scripts

- [ ] **Python**: Extract module scope in [python_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts)
  - Root scope becomes module definition
  - Module name from file path

- [ ] **Rust**: Extract module scope (mod blocks and file-level modules)
  - Handle explicit `mod` declarations
  - File-level implicit modules

### Phase 3: Registry Updates

- [ ] Update `DefinitionRegistry.get_callable_definitions()` to include modules
- [ ] Add `DefinitionRegistry.get_module_definitions()` helper
- [ ] Add `DefinitionRegistry.get_imported_module_symbols()` to track which modules are imported

### Phase 4: Call Graph Detection

- [ ] Update `build_function_nodes()` to handle `ModuleDefinition` ([detect_call_graph.ts](../../../packages/core/src/trace_call_graph/detect_call_graph.ts:9-41))
- [ ] Update `detect_entry_points()` to check module import status ([detect_call_graph.ts](../../../packages/core/src/trace_call_graph/detect_call_graph.ts:55-72))
- [ ] Add logic to track module invocations via imports

### Phase 5: Testing

- [ ] Add tests for module definitions in semantic index tests
- [ ] Add tests for module callable nodes in call graph tests
- [ ] Add tests for module entry point detection
- [ ] Test import-triggered initialization chains
- [ ] Test each language: TypeScript, JavaScript, Python, Rust

### Phase 6: Documentation

- [ ] Update architecture docs to explain module callables
- [ ] Document the import-invokes-module relationship
- [ ] Add examples of module entry point detection

## Acceptance Criteria

- [ ] `CallableDefinition` includes `ModuleDefinition`
- [ ] Each language extracts module-level scope as a `ModuleDefinition`
- [ ] Call graph detection creates `CallableNode` for modules
- [ ] Entry point detection identifies never-imported modules
- [ ] Module-level calls are tracked in call graphs
- [ ] All tests pass for TypeScript, JavaScript, Python, Rust
- [ ] Documentation explains the import-invokes-module model

## Edge Cases & Considerations

### 1. Dynamic Imports

JavaScript/TypeScript dynamic imports (`import()`) should still invoke the module:

```typescript
const module = await import('./my-module'); // Still invokes my-module
```

### 2. Circular Imports

Module invocation tracking must handle circular dependencies correctly.

### 3. Conditional Imports

Python: `if condition: import foo` - foo is conditionally invoked
JavaScript: Static imports always execute

### 4. Re-exports

Module re-exports don't re-execute the module:

```typescript
export { x } from './other'; // Doesn't count as invoking './other'
```

### 5. Module Scope vs File Scope

Languages differ:

- **Python**: File == Module (one module per file)
- **TypeScript/JavaScript**: File contains a module
- **Rust**: Explicit `mod` blocks create modules within files

### 6. Entry Point Files

Script files (no imports of them) are module entry points:

- Test files
- CLI entry points
- Scripts

## Related Work

### Dependencies

- Existing semantic index infrastructure
- Scope processing ([scope_processor.ts](../../../packages/core/src/index_single_file/scopes/scope_processor.ts))
- Import tracking (already in `ImportDefinition`)

### Related Tasks

- Task 106: Augment per-function context with call graph participation
- Epic 11: Codebase restructuring
- Call graph detection improvements

### Future Enhancements

After this task, we could:

1. Track import-time initialization order
2. Detect circular import problems
3. Measure module initialization performance
4. Optimize module load order

## Value Proposition

This change provides:

1. **Complete entry point detection**: Identify script files that are never imported
2. **Accurate call graphs**: Include module initialization in call chains
3. **Better architecture insights**: See which functions are called during initialization
4. **Import dependency analysis**: Understand module invocation relationships
5. **Foundation for advanced analysis**: Import order optimization, circular dependency detection

## Implementation Notes

To be filled in during implementation.

## Test Gaps

To be documented during implementation.
