# Task: Lexical Scope Resolution Infrastructure

**Task ID**: task-epic-11.91.2.1
**Parent**: task-epic-11.91.2
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Estimated Effort**: 1-1.5 days

## Problem Statement

Phase 2 of symbol resolution requires robust lexical scope traversal to resolve function calls. This task implements the core scope walking infrastructure, hoisting handling, and scope-based symbol lookup that will be used by the main function resolution algorithm.

### Current State

The semantic_index provides scope information, but we need:
- Scope chain traversal algorithms
- Language-specific hoisting rules
- Symbol lookup within scope hierarchies
- Integration points for function resolution

## Solution Overview

Build lexical scope resolution infrastructure that provides:
- Scope chain walking algorithms
- Hoisting handlers for different languages
- Symbol lookup and visibility rules
- Foundation for function call resolution

### Architecture

```
symbol_resolution/
├── function_resolution/
│   ├── scope_walker.ts        # Scope chain traversal
│   ├── hoisting_handler.ts    # Language-specific hoisting
│   ├── scope_types.ts         # Scope resolution types
│   └── scope_utilities.ts     # Scope analysis utilities
```

## Implementation Plan

### 1. Core Scope Types

**Module**: `function_resolution/scope_types.ts`

```typescript
interface ScopeResolutionContext {
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;
  readonly symbols: ReadonlyMap<SymbolId, SymbolDefinition>;
  readonly language: Language;
}

interface SymbolLookupResult {
  readonly symbol_id: SymbolId;
  readonly scope_id: ScopeId;
  readonly resolution_method: "lexical" | "hoisted" | "global";
  readonly visibility: "local" | "closure" | "global";
}

interface ScopeWalkOptions {
  readonly include_hoisted: boolean;
  readonly max_depth?: number;
  readonly visited_tracker?: Set<ScopeId>;
}

interface HoistingRules {
  readonly function_declarations: boolean;
  readonly var_declarations: boolean;
  readonly let_const_declarations: boolean;
  readonly class_declarations: boolean;
}
```

### 2. Scope Chain Walker

**Module**: `function_resolution/scope_walker.ts`

Core scope traversal that handles different resolution strategies:

```typescript
export function resolve_symbol_in_scope_chain(
  symbol_name: SymbolName,
  starting_scope: LexicalScope,
  context: ScopeResolutionContext,
  options: ScopeWalkOptions = { include_hoisted: true }
): SymbolLookupResult | null {
  const visited = options.visited_tracker || new Set<ScopeId>();
  let current_scope: LexicalScope | undefined = starting_scope;
  let depth = 0;

  while (current_scope && !visited.has(current_scope.id)) {
    // Check depth limit
    if (options.max_depth !== undefined && depth >= options.max_depth) {
      break;
    }

    visited.add(current_scope.id);

    // 1. Try direct symbol lookup in current scope
    const direct_result = find_symbol_in_scope(
      symbol_name,
      current_scope,
      context.symbols
    );

    if (direct_result) {
      return {
        symbol_id: direct_result,
        scope_id: current_scope.id,
        resolution_method: "lexical",
        visibility: depth === 0 ? "local" : "closure"
      };
    }

    // 2. Try hoisted symbols if enabled
    if (options.include_hoisted) {
      const hoisted_result = find_hoisted_symbol_in_scope(
        symbol_name,
        current_scope,
        context
      );

      if (hoisted_result) {
        return {
          symbol_id: hoisted_result,
          scope_id: current_scope.id,
          resolution_method: "hoisted",
          visibility: depth === 0 ? "local" : "closure"
        };
      }
    }

    // Move to parent scope
    current_scope = current_scope.parent_id
      ? context.scopes.get(current_scope.parent_id)
      : undefined;
    depth++;
  }

  return null;
}

function find_symbol_in_scope(
  symbol_name: SymbolName,
  scope: LexicalScope,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): SymbolId | null {
  // Look for symbols defined in this scope
  for (const symbol_id of scope.defined_symbols) {
    const symbol_def = symbols.get(symbol_id);
    if (symbol_def && symbol_def.name === symbol_name) {
      return symbol_id;
    }
  }

  return null;
}
```

### 3. Hoisting Handler

**Module**: `function_resolution/hoisting_handler.ts`

Language-specific hoisting behavior:

```typescript
export function find_hoisted_symbol_in_scope(
  symbol_name: SymbolName,
  scope: LexicalScope,
  context: ScopeResolutionContext
): SymbolId | null {
  const hoisting_rules = get_hoisting_rules(context.language);

  // Search through all symbols in scope and child scopes for hoisted declarations
  for (const symbol_id of scope.defined_symbols) {
    const symbol_def = context.symbols.get(symbol_id);
    if (!symbol_def || symbol_def.name !== symbol_name) {
      continue;
    }

    if (is_symbol_hoisted(symbol_def, hoisting_rules)) {
      return symbol_id;
    }
  }

  // Check child scopes for hoisted declarations that bubble up
  if (hoisting_rules.function_declarations) {
    for (const child_scope_id of scope.child_scopes) {
      const child_scope = context.scopes.get(child_scope_id);
      if (child_scope) {
        const hoisted_from_child = find_hoisted_function_declarations(
          symbol_name,
          child_scope,
          context
        );
        if (hoisted_from_child) {
          return hoisted_from_child;
        }
      }
    }
  }

  return null;
}

function get_hoisting_rules(language: Language): HoistingRules {
  switch (language) {
    case "javascript":
    case "typescript":
      return {
        function_declarations: true,
        var_declarations: true,
        let_const_declarations: false,
        class_declarations: false
      };

    case "python":
      return {
        function_declarations: false,
        var_declarations: false,
        let_const_declarations: false,
        class_declarations: false
      };

    case "rust":
      return {
        function_declarations: true, // Items available throughout module
        var_declarations: false,
        let_const_declarations: false,
        class_declarations: true
      };

    default:
      return {
        function_declarations: false,
        var_declarations: false,
        let_const_declarations: false,
        class_declarations: false
      };
  }
}

function is_symbol_hoisted(
  symbol_def: SymbolDefinition,
  rules: HoistingRules
): boolean {
  switch (symbol_def.kind) {
    case "function":
      return rules.function_declarations;
    case "variable":
      // Check if it's var, let, or const based on modifiers
      return symbol_def.modifiers?.includes("var") && rules.var_declarations;
    case "class":
      return rules.class_declarations;
    default:
      return false;
  }
}
```

### 4. Scope Utilities

**Module**: `function_resolution/scope_utilities.ts`

Helper functions for scope analysis:

```typescript
export function find_containing_function_scope(
  location: Location,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope | null {
  // Find the nearest function scope that contains this location
  for (const scope of scopes.values()) {
    if (scope.kind === "function" && location_in_scope(location, scope)) {
      return scope;
    }
  }
  return null;
}

export function get_scope_chain(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope[] {
  const chain: LexicalScope[] = [];
  let current: LexicalScope | undefined = scope;

  while (current) {
    chain.push(current);
    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  return chain;
}

export function location_in_scope(location: Location, scope: LexicalScope): boolean {
  // Check if location falls within scope boundaries
  return (
    location.start_line >= scope.range.start_line &&
    location.end_line <= scope.range.end_line &&
    (location.start_line !== scope.range.start_line ||
     location.start_column >= scope.range.start_column) &&
    (location.end_line !== scope.range.end_line ||
     location.end_column <= scope.range.end_column)
  );
}

export function is_global_scope(scope: LexicalScope): boolean {
  return scope.kind === "module" || scope.parent_id === undefined;
}

export function get_function_scopes_in_file(
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  file_path: FilePath
): LexicalScope[] {
  return Array.from(scopes.values()).filter(
    scope => scope.kind === "function" && scope.location.file_path === file_path
  );
}
```

### 5. Global Symbol Resolution

Handle built-in and global symbols:

```typescript
export function resolve_global_symbol(
  symbol_name: SymbolName,
  language: Language
): SymbolId | null {
  const global_symbols = get_global_symbols(language);
  return global_symbols.get(symbol_name) || null;
}

function get_global_symbols(language: Language): Map<SymbolName, SymbolId> {
  const globals = new Map<SymbolName, SymbolId>();

  switch (language) {
    case "javascript":
    case "typescript":
      // Browser/Node.js globals
      globals.set("console" as SymbolName, create_builtin_symbol("console", "javascript"));
      globals.set("setTimeout" as SymbolName, create_builtin_symbol("setTimeout", "javascript"));
      globals.set("fetch" as SymbolName, create_builtin_symbol("fetch", "javascript"));
      break;

    case "python":
      // Python built-ins
      globals.set("print" as SymbolName, create_builtin_symbol("print", "python"));
      globals.set("len" as SymbolName, create_builtin_symbol("len", "python"));
      globals.set("str" as SymbolName, create_builtin_symbol("str", "python"));
      break;

    case "rust":
      // Rust standard library (implicitly available)
      globals.set("println!" as SymbolName, create_builtin_symbol("println!", "rust"));
      globals.set("vec!" as SymbolName, create_builtin_symbol("vec!", "rust"));
      break;
  }

  return globals;
}

function create_builtin_symbol(name: string, language: string): SymbolId {
  return `builtin:${language}:${name}` as SymbolId;
}
```

## Testing Strategy

### Unit Tests

- Scope chain traversal with various nesting levels
- Hoisting behavior for each language
- Symbol visibility and resolution order
- Global symbol resolution
- Edge cases (circular scope references, missing scopes)

### Test Fixtures

```
fixtures/
├── scope_resolution/
│   ├── nested_functions/
│   ├── closure_variables/
│   ├── hoisting_patterns/
│   └── global_access/
└── language_specific/
    ├── javascript_hoisting/
    ├── python_scoping/
    └── rust_items/
```

## Success Criteria

1. **Accurate Scope Walking**: Correctly traverses scope chains in all languages
2. **Hoisting Compliance**: Implements language-specific hoisting rules
3. **Symbol Visibility**: Respects variable visibility and closure rules
4. **Global Resolution**: Handles built-in and global symbols appropriately
5. **Performance**: Efficient scope traversal for deeply nested code
6. **Integration Ready**: Clean interfaces for function resolution integration

## Dependencies

- **Prerequisite**: Semantic index scope extraction (✅ available)
- **Enables**: task-epic-11.91.2.2 (Function call resolution)
- **No blocking dependencies**: Can be developed independently

## Implementation Notes

- Reuse existing `LexicalScope` types from semantic_index
- Handle circular scope references gracefully
- Optimize for common patterns (local variable access)
- Include comprehensive logging for debugging scope resolution
- Design for testability with mock scope hierarchies

## References

- JavaScript lexical scoping and hoisting specification
- Python LEGB rule (Local, Enclosing, Global, Built-in)
- Rust ownership and scope rules
- Existing scope_tree implementation in semantic_index

## Implementation Notes

**Completed**: 2025-01-21

### What Was Implemented

1. **Core Module Structure**
   - Created `symbol_resolution/function_resolution/` directory with all planned modules
   - `scope_types.ts` - Core interfaces (ScopeResolutionContext, SymbolLookupResult, HoistingRules, etc.)
   - `scope_walker.ts` - Scope chain traversal with cycle detection
   - `hoisting_handler.ts` - Language-specific hoisting and built-in symbols
   - `scope_utilities.ts` - 13+ helper functions for scope analysis
   - `index.ts` - Clean public API exports

2. **Scope Resolution Features**
   - Complete scope chain traversal with visited tracking to prevent infinite loops
   - Three-tier symbol resolution: lexical → hoisted → global
   - Visibility classification: local, closure, or global
   - Configurable max depth and hoisting options
   - Additional utilities beyond plan:
     - `find_common_ancestor_scope`
     - `is_symbol_accessible_from_scope`
     - `analyze_scopes_at_location`
     - `get_symbols_in_scope`

3. **Language Support**
   - **JavaScript/TypeScript**:
     - Full function and var hoisting
     - 40+ built-in globals (console, Promise, Array, window, process, etc.)
     - Temporal dead zone noted but not enforced
   - **Python**:
     - No hoisting (strict definition-before-use)
     - 50+ built-in functions (print, len, str, etc.)
     - nonlocal/global not yet implemented
   - **Rust**:
     - Item-level availability throughout module
     - 30+ macro globals (println!, vec!, etc.)

4. **Testing**
   - Comprehensive test suite in `scope_resolution.test.ts`
   - 18 tests covering all major functionality
   - Mock data approach for unit testing
   - All tests passing

### Deviations from Original Plan

1. **Interface Changes**:
   - Used existing `LexicalScope.symbols` Map instead of planned `defined_symbols` array
   - Used `child_ids` instead of `child_scopes` property
   - Symbol lookup adapted to work with Map structure

2. **Extended Functionality**:
   - Added more utility functions than originally planned
   - Built-in symbol tables much more comprehensive (100+ total symbols vs handful shown in plan)
   - Added documentation field to BuiltinSymbol type

3. **Simplified Approaches**:
   - Hoisting detection relies on `is_hoisted` flag from semantic index rather than analyzing modifiers
   - Location comparison uses simple numeric comparisons instead of range objects

### Skipped/Deferred Work

1. **Python Language Features**:
   - `nonlocal` and `global` keyword support (config exists but not implemented)
   - LEGB rule not explicitly modeled

2. **JavaScript/TypeScript Features**:
   - Temporal dead zone enforcement for let/const
   - Dynamic environment detection (Node.js vs Browser globals)
   - Class expression hoisting edge cases

3. **Performance Optimizations**:
   - No caching mechanism for repeated symbol lookups
   - No optimization for common patterns (local variable access)
   - No lazy evaluation of scope chains

4. **Advanced Features**:
   - `with` statement scope handling
   - `eval` scope injection
   - Dynamic scope creation

### Follow-On Tasks Identified

1. **task-epic-11.91.2.1.1**: Python nonlocal/global support
   - Implement nonlocal and global declaration tracking
   - Modify scope walker to respect these declarations

2. **task-epic-11.91.2.1.2**: Performance optimization
   - Add symbol lookup caching
   - Implement lazy scope chain evaluation
   - Optimize for common access patterns

3. **task-epic-11.91.2.1.3**: Environment-specific globals
   - Runtime environment detection
   - Conditional global symbol tables
   - TypeScript lib.d.ts integration

4. **Integration Requirements**:
   - Ensure semantic index properly sets `is_hoisted` flag
   - Validate scope.symbols Map is populated correctly
   - Test with real semantic index data

### Integration Readiness

The infrastructure is ready for integration with:
- ✅ Import resolution (can lookup imported symbols)
- ✅ Function call resolution (can resolve function names)
- ✅ Method resolution (utilities support member lookups)
- ⚠️ Requires semantic index to provide proper `is_hoisted` flags
- ⚠️ Assumes scope.symbols Map is populated