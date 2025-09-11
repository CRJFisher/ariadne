# Task 11.100.5: Transform function_calls to Tree-sitter Queries

## Parent Task
11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.5.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.5.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview
**Location**: `src/call_graph/function_calls/`
**Files**: 5+ files (~1,500 lines)
- `function_calls.ts` - Generic processor
- `function_calls.typescript.ts` - TS-specific
- `function_calls.python.ts` - Python calls
- `function_calls.rust.ts` - Rust calls
- Configuration and index files

## Current Implementation

### Manual Call Detection
```typescript
function find_function_calls(node: SyntaxNode) {
  if (node.type === 'call_expression') {
    const function = node.childForFieldName('function');
    const arguments = node.childForFieldName('arguments');
    
    if (function.type === 'identifier') {
      // Simple function call
      const name = function.text;
      const argCount = countArguments(arguments);
      // ... extract call info
    } else if (function.type === 'member_expression') {
      // Method call - handle separately
    }
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern
```scheme
;; call_queries/function_calls.scm

;; JavaScript/TypeScript function calls
(call_expression
  function: (identifier) @call.function.name
  arguments: (arguments) @call.function.args) @call.function

;; Exclude method calls (handled separately)
(call_expression
  function: (identifier) @call.function.name
  arguments: (arguments) @call.function.args
  (#not-parent-type? @call.function.name member_expression))

;; Python function calls
(call
  function: (identifier) @call.function.name
  arguments: (argument_list) @call.function.args) @call.function

;; Python calls with module prefix
(call
  function: (attribute
    object: (identifier) @call.function.module
    attribute: (identifier) @call.function.name)
  arguments: (argument_list) @call.function.args) @call.function.qualified

;; Rust function calls
(call_expression
  function: (identifier) @call.function.name
  arguments: (arguments) @call.function.args) @call.function

;; Rust path calls (std::println!)
(call_expression
  function: (scoped_identifier
    path: (_) @call.function.path
    name: (identifier) @call.function.name)
  arguments: (arguments) @call.function.args) @call.function.scoped

;; Macro calls
(macro_invocation
  macro: (identifier) @call.macro.name
  (token_tree) @call.macro.args) @call.macro
```

### New Implementation
```typescript
export function find_function_calls_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): FunctionCallInfo[] {
  const query = loadCallQuery(language);
  const captures = query.captures(tree.rootNode);
  
  // Filter to function calls only
  const functionCalls = captures.filter(c => 
    c.name.startsWith('call.function'));
  
  // Group by call site
  const callGroups = groupByCallSite(functionCalls);
  
  return callGroups.map(group => ({
    callee_name: extractCalleeName(group),
    arguments_count: countArguments(group),
    is_async: checkAsyncCall(group),
    location: group[0].node.startPosition,
    type: 'function'
  }));
}
```

## Transformation Steps

### 1. Document Call Patterns
- [ ] Simple function calls
- [ ] Qualified calls (module.function)
- [ ] Dynamic calls (computed names)
- [ ] IIFE patterns
- [ ] Async calls
- [ ] Macro invocations (Rust)

### 2. Create Call Queries
- [ ] **Create language-specific .scm files**:
  - `queries/function_calls.javascript.scm` - JS function calls, IIFE, arrow functions
  - `queries/function_calls.typescript.scm` - TS typed calls, generics, overloads
  - `queries/function_calls.python.scm` - Python calls, decorators, *args/**kwargs
  - `queries/function_calls.rust.scm` - Rust function calls, closures, macro invocations
- [ ] Distinguish function vs method calls
- [ ] Capture argument information
- [ ] Handle call chains
- [ ] Track async/await

### 3. Build Call Extractor
- [ ] Extract callee names
- [ ] Count arguments
- [ ] Determine call type
- [ ] Track call context

## Expected Improvements

### Code Reduction
- **Before**: ~1,500 lines
- **After**: ~150 lines + queries
- **Reduction**: 90%

### Accuracy
- Catches all call patterns
- Properly distinguishes call types

## Success Criteria

### Functional Requirements
- [ ] All function calls detected
- [ ] Argument counts correct
- [ ] No method calls included
- [ ] 90% code reduction

### Quality Gates (MANDATORY)

**All quality gates are defined in the required subtasks:**

- [ ] **100% test coverage achieved** (Task 11.100.X.1)
- [ ] **All tests passing** (Task 11.100.X.1)  
- [ ] **Zero TypeScript compilation errors** (Task 11.100.X.2)
- [ ] **Zero TypeScript warnings** (Task 11.100.X.2)
- [ ] **Performance improvement validated** (queries faster than manual)
- [ ] **Real-world accuracy confirmed** (corpus/ validation passes)
- [ ] **All language-specific .scm files created and tested**
