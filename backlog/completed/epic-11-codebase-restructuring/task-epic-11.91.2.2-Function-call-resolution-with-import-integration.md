# Task: Function Call Resolution with Import Integration

**Task ID**: task-epic-11.91.2.2
**Parent**: task-epic-11.91.2
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Completed**: 2025-01-22
**Estimated Effort**: 1-1.5 days
**Actual Effort**: 0.5 days

## Problem Statement

With lexical scope infrastructure complete and import resolution available, we can now implement the core function call resolution algorithm that combines scope-based lookup with cross-file import resolution to accurately map function calls to their definitions.

### Current State

After previous tasks:
- ✅ Import resolution (task 11.91.1)
- ✅ Lexical scope infrastructure (task 11.91.2.1)
- ❌ Function call resolution algorithm

## Solution Overview

Implement function call resolution that:
- Uses scope walking for local function resolution
- Integrates with import resolution for cross-file calls
- Handles built-in and global functions
- Provides comprehensive mapping from call sites to function definitions

### Architecture

```
symbol_resolution/
├── function_resolution/
│   ├── index.ts              # Public API
│   ├── function_resolver.ts  # Main resolution algorithm
│   ├── function_types.ts     # Function resolution types
│   └── resolution_priority.ts # Resolution order logic
```

## Implementation Plan

### 1. Function Resolution Types

**Module**: `function_resolution/function_types.ts`

```typescript
interface FunctionCallResolution {
  readonly call_location: Location;
  readonly resolved_function: SymbolId;
  readonly resolution_method: "lexical" | "imported" | "global" | "builtin";
  readonly scope_chain?: readonly ScopeId[];
  readonly import_source?: FilePath;
}

interface FunctionResolutionMap {
  readonly function_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly calls_to_function: ReadonlyMap<SymbolId, readonly Location[]>;
  readonly resolution_details: ReadonlyMap<LocationKey, FunctionCallResolution>;
}

interface FunctionResolutionContext {
  readonly indices: ReadonlyMap<FilePath, SemanticIndex>;
  readonly imports: ImportResolutionMap;
  readonly file_path: FilePath;
  readonly file_index: SemanticIndex;
  readonly file_imports: ReadonlyMap<SymbolName, SymbolId>;
}

// **⚠️ Critical**: Use LocationKey for map keys to ensure proper equality
function location_key(location: Location): LocationKey {
  return `${location.file_path}:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}` as LocationKey;
}
```

### 2. Main Resolution Algorithm

**Module**: `function_resolution/function_resolver.ts`

```typescript
export function resolve_function_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): FunctionResolutionMap {
  const function_calls = new Map<LocationKey, SymbolId>();
  const calls_to_function = new Map<SymbolId, Location[]>();
  const resolution_details = new Map<LocationKey, FunctionCallResolution>();

  for (const [file_path, index] of indices) {
    const file_imports = imports.imports.get(file_path) || new Map();
    const context: FunctionResolutionContext = {
      indices,
      imports,
      file_path,
      file_index: index,
      file_imports
    };

    // Process all function call references in this file
    for (const call_ref of index.references.calls) {
      if (call_ref.call_type === "function") {
        const resolution = resolve_single_function_call(call_ref, context);

        if (resolution) {
          const location_key_val = location_key(call_ref.location);

          function_calls.set(location_key_val, resolution.resolved_function);
          resolution_details.set(location_key_val, resolution);

          // Update reverse mapping
          const call_locations = calls_to_function.get(resolution.resolved_function) || [];
          call_locations.push(call_ref.location);
          calls_to_function.set(resolution.resolved_function, call_locations);
        }
      }
    }
  }

  return { function_calls, calls_to_function, resolution_details };
}

function resolve_single_function_call(
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  const function_name = call_ref.name;

  // Resolution priority order
  const resolution_strategies = [
    () => try_lexical_resolution(function_name, call_ref, context),
    () => try_imported_resolution(function_name, context),
    () => try_global_resolution(function_name, context.file_index.language),
    () => try_builtin_resolution(function_name, context.file_index.language)
  ];

  for (const strategy of resolution_strategies) {
    const result = strategy();
    if (result) {
      return result;
    }
  }

  return null; // Unresolved
}
```

### 3. Resolution Strategies

**Module**: `function_resolution/resolution_priority.ts`

```typescript
function try_lexical_resolution(
  function_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  // Find the scope containing this call
  const call_scope = context.file_index.scopes.get(call_ref.scope_id);
  if (!call_scope) {
    return null;
  }

  // Use scope walker to find function in scope chain
  const scope_context: ScopeResolutionContext = {
    scopes: context.file_index.scopes,
    symbols: context.file_index.symbols,
    language: context.file_index.language
  };

  const lookup_result = resolve_symbol_in_scope_chain(
    function_name,
    call_scope,
    scope_context
  );

  if (lookup_result && is_function_symbol(lookup_result.symbol_id, context.file_index.symbols)) {
    return {
      call_location: call_ref.location,
      resolved_function: lookup_result.symbol_id,
      resolution_method: lookup_result.resolution_method,
      scope_chain: build_scope_chain_ids(call_scope, context.file_index.scopes)
    };
  }

  return null;
}

function try_imported_resolution(
  function_name: SymbolName,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  const imported_symbol = context.file_imports.get(function_name);
  if (!imported_symbol) {
    return null;
  }

  // Verify it's actually a function
  const source_file = find_symbol_source_file(imported_symbol, context.indices);
  if (source_file && is_function_symbol(imported_symbol, context.indices.get(source_file)?.symbols)) {
    return {
      call_location: context.file_path as any, // Will be set by caller
      resolved_function: imported_symbol,
      resolution_method: "imported",
      import_source: source_file
    };
  }

  return null;
}

function try_global_resolution(
  function_name: SymbolName,
  language: Language
): FunctionCallResolution | null {
  const global_symbol = resolve_global_symbol(function_name, language);
  if (global_symbol) {
    return {
      call_location: null as any, // Will be set by caller
      resolved_function: global_symbol,
      resolution_method: "global"
    };
  }

  return null;
}

function try_builtin_resolution(
  function_name: SymbolName,
  language: Language
): FunctionCallResolution | null {
  const builtin_symbol = resolve_builtin_function(function_name, language);
  if (builtin_symbol) {
    return {
      call_location: null as any, // Will be set by caller
      resolved_function: builtin_symbol,
      resolution_method: "builtin"
    };
  }

  return null;
}
```

### 4. Helper Functions

```typescript
function is_function_symbol(
  symbol_id: SymbolId,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition> | undefined
): boolean {
  if (!symbols) return false;

  const symbol_def = symbols.get(symbol_id);
  return symbol_def?.kind === "function" || symbol_def?.kind === "method";
}

function find_symbol_source_file(
  symbol_id: SymbolId,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): FilePath | null {
  for (const [file_path, index] of indices) {
    if (index.symbols.has(symbol_id)) {
      return file_path;
    }
  }
  return null;
}

function build_scope_chain_ids(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): ScopeId[] {
  const chain = get_scope_chain(scope, scopes);
  return chain.map(s => s.id);
}

function resolve_builtin_function(
  function_name: SymbolName,
  language: Language
): SymbolId | null {
  // Language-specific built-in functions
  const builtins = get_builtin_functions(language);
  return builtins.get(function_name) || null;
}

function get_builtin_functions(language: Language): Map<SymbolName, SymbolId> {
  const builtins = new Map<SymbolName, SymbolId>();

  switch (language) {
    case "javascript":
    case "typescript":
      builtins.set("parseInt" as SymbolName, create_builtin_symbol("parseInt", "javascript"));
      builtins.set("parseFloat" as SymbolName, create_builtin_symbol("parseFloat", "javascript"));
      builtins.set("isNaN" as SymbolName, create_builtin_symbol("isNaN", "javascript"));
      break;

    case "python":
      builtins.set("range" as SymbolName, create_builtin_symbol("range", "python"));
      builtins.set("enumerate" as SymbolName, create_builtin_symbol("enumerate", "python"));
      builtins.set("zip" as SymbolName, create_builtin_symbol("zip", "python"));
      break;

    case "rust":
      // Rust functions are typically method calls or explicitly imported
      break;
  }

  return builtins;
}
```

### 5. Public API

**Module**: `function_resolution/index.ts`

```typescript
export { resolve_function_calls } from './function_resolver';
export type {
  FunctionCallResolution,
  FunctionResolutionMap,
  FunctionResolutionContext
} from './function_types';

// Integration with symbol_resolution.ts Phase 2
export function phase2_resolve_functions(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): FunctionResolutionMap {
  return resolve_function_calls(indices, imports);
}
```

### 6. Integration Point Update

Update `symbol_resolution.ts`:

```typescript
import { phase2_resolve_functions } from './function_resolution';

function phase2_resolve_functions_integration(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): FunctionResolutionMap {
  return phase2_resolve_functions(indices, imports);
}
```

## Testing Strategy

### Unit Tests

- Function call resolution with various scope nesting
- Import-based function resolution
- Built-in and global function resolution
- Resolution priority order verification
- LocationKey equality and mapping

### Integration Tests

- Cross-file function calls
- Mixed local and imported function calls
- Complex scope scenarios (closures, nested functions)
- Language-specific function resolution patterns

### Test Fixtures

```
fixtures/
├── function_resolution/
│   ├── local_calls/
│   ├── imported_calls/
│   ├── builtin_calls/
│   └── mixed_resolution/
└── scope_integration/
    ├── nested_functions/
    ├── closures/
    └── hoisted_functions/
```

## Success Criteria

1. **Accurate Resolution**: Function calls correctly mapped to definitions
2. **Multi-Strategy**: Handles lexical, imported, global, and built-in functions
3. **Priority Order**: Correct resolution precedence (lexical > imported > global > builtin)
4. **Cross-File Support**: Seamless integration with import resolution
5. **Performance**: Efficient resolution for large codebases
6. **Location Accuracy**: Precise mapping using LocationKey

## Dependencies

- **Prerequisite**: task-epic-11.91.1 (Import resolution) - must be completed
- **Prerequisite**: task-epic-11.91.2.1 (Scope infrastructure) - must be completed
- **Enables**: Complete Phase 2 function resolution
- **Enables**: task-epic-11.91.3 (Method resolution can build on function resolution)

## Implementation Notes

- Use `LocationKey` for all map keys to ensure proper equality
- Leverage scope walking infrastructure from 11.91.2.1
- Integrate seamlessly with import resolution from 11.91.1
- Include comprehensive error handling for edge cases
- Optimize for common resolution patterns (local functions)
- Provide detailed resolution information for debugging

## References

- Lexical scoping rules for supported languages
- Function call semantics and resolution order
- Integration patterns with import resolution
- Existing scope_tree and semantic_index implementations

## Implementation Notes

### Completed Implementation (2025-01-22)

Successfully implemented function call resolution with import integration:

1. **Created Core Types** (`function_types.ts`):
   - `FunctionCallResolution` interface for single call resolution
   - `FunctionResolutionMap` for complete resolution mapping
   - `FunctionResolutionContext` for resolution context

2. **Main Resolution Algorithm** (`function_resolver.ts`):
   - `resolve_function_calls()` processes all files and call references
   - Filters to only handle `call_type === "function"`
   - Uses `LocationKey` for proper map key equality
   - Builds bidirectional mappings (calls → functions, functions → calls)

3. **Resolution Strategies** (`resolution_priority.ts`):
   - Lexical resolution using scope walker infrastructure
   - Imported symbol resolution via import maps
   - Global/built-in resolution through `resolve_global_symbol`
   - Correct priority order: lexical > imported > global

4. **Integration Points**:
   - Updated `function_resolution/index.ts` with public API
   - Integrated with `symbol_resolution.ts` Phase 2
   - Uses existing scope walker from task 11.91.2.1
   - Leverages `resolve_global_symbol` from hoisting handler

5. **Key Decisions**:
   - Unified global and built-in resolution (both handled by `resolve_global_symbol`)
   - Used existing built-in symbol format from hoisting_handler ("builtin:language:name")
   - Added missing JavaScript global functions (parseInt, parseFloat, etc.)

6. **Testing**:
   - Comprehensive test suite with 16 test cases, all passing:
     - Basic lexical function resolution
     - Imported function resolution across files
     - Built-in function resolution (JavaScript, Python, Rust)
     - Multiple function calls to same/different functions
     - Filtering of method and constructor calls
     - Unresolved function handling
     - Nested function scopes
     - Function name shadowing in different scopes
     - TypeScript-specific global types
     - Edge cases (empty indices, super calls, missing imports)
   - Provides detailed resolution information for debugging

### Technical Highlights

- Properly uses `LocationKey` instead of `Location` for map keys
- Integrates seamlessly with existing infrastructure
- Handles all supported languages (JavaScript, TypeScript, Python, Rust)
- Provides detailed resolution information for debugging

### Performance Considerations

- Efficient single-pass resolution
- Leverages existing scope and import data structures
- No redundant computation or duplicate resolution

## Deviations from Original Plan

### 1. Unified Global and Built-in Resolution
**Plan**: Separate `try_global_resolution` and `try_builtin_resolution` strategies
**Implementation**: Unified both into `try_global_resolution` using existing `resolve_global_symbol`
**Rationale**: The `resolve_global_symbol` function in hoisting_handler already handles both global symbols and built-in functions, making separate resolution redundant. The `try_builtin_resolution` now returns null.

### 2. Built-in Symbol Format
**Plan**: Create new built-in symbol IDs using function_symbol factory
**Implementation**: Used existing format from hoisting_handler ("builtin:language:name")
**Rationale**: Maintains consistency with existing infrastructure and avoids creating duplicate symbol ID formats

### 3. Resolution Details Storage
**Plan**: Basic function-to-call mappings
**Implementation**: Added `resolution_details` map with comprehensive debugging information
**Rationale**: Provides valuable debugging capability for understanding how each call was resolved

## Skipped Work

### 1. Explicit Hoisting Tests
While the infrastructure supports hoisted function resolution through the scope walker, explicit test cases for JavaScript hoisting (e.g., calling a function before its declaration, var hoisting) were not included. The functionality exists through the scope walker but lacks dedicated test coverage.

### 2. Detailed Error Reporting
The implementation returns `null` for unresolved functions without capturing why resolution failed (e.g., "not in scope", "import not found", etc.). This information could be valuable for debugging and error messages.

### 3. Resolution Details Integration
The `resolution_details` map provides rich debugging information but is not currently used by the main `symbol_resolution.ts` integration. This data is computed but not exposed in the final pipeline result.

### 4. Cross-file Closure Resolution
While imports are resolved across files, closure capture of functions from parent scopes across module boundaries is not explicitly tested.

## Follow-on Tasks Identified

### 1. **Enhanced Hoisting Support** (Priority: Medium)
- Add explicit test cases for hoisted function declarations
- Test temporal dead zone handling for const/let functions
- Verify var function expression hoisting behavior

### 2. **Rust Function Resolution** (Priority: Low)
- Current implementation only handles Rust macros (println!, etc.)
- Need to investigate Rust's function resolution patterns
- May need special handling for trait methods and associated functions

### 3. **Error Diagnostics** (Priority: Medium)
- Capture resolution failure reasons
- Provide detailed diagnostics for unresolved function calls
- Could help with IDE features and debugging

### 4. **Resolution Caching** (Priority: Low)
- For incremental updates, cache resolution results
- Only re-resolve affected files when imports change
- Performance optimization for large codebases

### 5. **Async Function Handling** (Priority: Low)
- Verify async/await function resolution works correctly
- May need special handling for Promise-returning functions
- Test generator functions and async generators

### 6. **Resolution Details API** (Priority: Medium)
- Expose resolution_details through the main pipeline
- Add query methods to find how a specific call was resolved
- Useful for debugging and visualization tools

## Next Steps

The function call resolution phase is now complete and integrated. The next immediate priority should be:

1. **task-epic-11.91.3**: Method and constructor resolution
2. Continue with the remaining symbol resolution pipeline phases

The follow-on tasks identified above can be addressed as separate improvements once the core pipeline is complete.

## Effort Analysis

**Estimated**: 1-1.5 days
**Actual**: 0.5 days

The implementation was completed faster than expected due to:
- Excellent reuse of existing infrastructure (scope walker, hoisting handler)
- Clear architectural patterns from import resolution implementation
- Well-defined interfaces from the parent task
- Leveraging existing built-in symbol resolution instead of reimplementing

This validates the modular approach and infrastructure investment from previous tasks.

## Lessons Learned

### What Worked Well
1. **Infrastructure Reuse**: The scope walker and hoisting handler provided exactly the needed functionality
2. **Clear Interfaces**: Well-defined types from parent task made integration straightforward
3. **Test-Driven Approach**: Writing comprehensive tests helped catch integration issues early
4. **Incremental Integration**: Building on top of import resolution was seamless

### Areas for Improvement
1. **Documentation**: Could have documented the existing hoisting_handler capabilities better to avoid initial confusion about built-in symbols
2. **Test Organization**: The test file became quite large (985 lines); could benefit from splitting into multiple files
3. **Error Context**: Should have included resolution failure reasons from the start
4. **Performance Metrics**: No benchmarking was done to validate performance assumptions

### Recommendations for Next Tasks
1. Consider exposing resolution_details in the main pipeline from the start
2. Add performance benchmarks for large codebases
3. Document existing infrastructure capabilities more thoroughly
4. Consider a unified error reporting strategy across all resolution phases