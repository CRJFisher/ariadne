---
id: task-epic-11.65
title: Implement Async Flow Analysis
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, layer-4, layer-9, control-flow, missing-functionality]
dependencies: [task-epic-11.62]
parent_task_id: epic-11
---

## Description

Implement comprehensive async/await flow analysis to track asynchronous execution paths. Currently, call chains break at async boundaries, and we cannot trace async execution flows or Promise chains.

## Context

From PROCESSING_PIPELINE.md:
- Layer 4: Need Async Call Detection (per-file)
- Layer 9: Need Async Flow Analysis (global, trace execution flows)

From ARCHITECTURE_ISSUES.md (Issue #11):
- Async/await and Promise chains not tracked
- Call chains break at async boundaries
- Cannot trace async execution paths
- Missing important control flow information

## Acceptance Criteria

### Phase 1: Async Call Detection (Per-File, Layer 4)
- [ ] Create `/call_graph/async_calls/index.ts` module
- [ ] Detect async patterns:
  - Async function declarations: `async function foo()`
  - Async arrow functions: `async () => {}`
  - Async methods: `async methodName()`
  - Promise constructors: `new Promise()`
  - Promise methods: `.then()`, `.catch()`, `.finally()`
- [ ] Track await expressions:
  ```typescript
  const result = await someAsyncFunction();
  ```
- [ ] Identify callback patterns:
  - setTimeout/setInterval
  - Event handlers
  - Node.js callbacks

### Phase 2: Promise Chain Tracking
- [ ] Track Promise method chains:
  ```typescript
  fetchData()
    .then(processData)
    .then(saveResults)
    .catch(handleError)
  ```
- [ ] Track Promise combinators:
  - `Promise.all()`
  - `Promise.race()`
  - `Promise.allSettled()`
  - `Promise.any()`
- [ ] Handle async/await transformations:
  ```typescript
  // These are equivalent:
  await foo();
  foo().then(() => {});
  ```

### Phase 3: Async Flow Analysis (Global, Layer 9)
- [ ] Create `/call_graph/async_flow_analysis/index.ts` module
- [ ] Build async execution graphs:
  - Connect async function calls
  - Track Promise resolution flows
  - Handle concurrent executions
- [ ] Trace async call stacks:
  ```typescript
  async function a() { await b(); }
  async function b() { await c(); }
  // Trace: a → b → c
  ```
- [ ] Identify async patterns:
  - Sequential execution
  - Parallel execution
  - Race conditions
  - Deadlocks

### Phase 4: Language-Specific Support

**JavaScript/TypeScript:**
- [ ] async/await (ES2017+)
- [ ] Promises (ES6+)
- [ ] Generators with async: `async function*`
- [ ] Top-level await (ES2022+)
- [ ] AsyncIterator protocol

**Python:**
- [ ] async/await (Python 3.5+)
- [ ] asyncio patterns
- [ ] async generators: `async def gen()`
- [ ] async context managers: `async with`
- [ ] async iterators: `async for`

**Rust:**
- [ ] async/await
- [ ] Future trait
- [ ] async blocks: `async { }`
- [ ] async closures
- [ ] tokio/async-std patterns

### Phase 5: Integration
- [ ] Extend call_chain_analysis to handle async flows:
  ```typescript
  interface AsyncCallChain {
    sync_segments: CallChain[];
    async_boundaries: AsyncBoundary[];
    execution_order: 'sequential' | 'parallel' | 'mixed';
  }
  ```
- [ ] Update type_tracking for Promise types:
  ```typescript
  // Track Promise<T> through flows
  const promise: Promise<number> = asyncFunc();
  const value: number = await promise; // Unwrap type
  ```
- [ ] Integrate with existing call graph

### Phase 6: Advanced Analysis
- [ ] Detect common async anti-patterns:
  - Forgotten await
  - Promise constructor anti-pattern
  - Async function in forEach
  - Unhandled rejections
- [ ] Performance analysis:
  - Identify blocking operations
  - Find unnecessary async
  - Detect async waterfalls
- [ ] Concurrency analysis:
  - Race condition detection
  - Deadlock detection

### Testing
- [ ] Test async function detection
- [ ] Test Promise chain tracking
- [ ] Test await expression handling
- [ ] Test complex async flows:
  - Nested async calls
  - Parallel Promise.all
  - Error propagation
  - Mixed sync/async code
- [ ] Test language-specific patterns

## Implementation Notes

### Data Structures

```typescript
interface AsyncCallInfo {
  caller: string;
  callee: string;
  call_type: 'await' | 'then' | 'catch' | 'finally' | 'callback';
  location: Location;
  is_parallel?: boolean;
}

interface PromiseChain {
  start: string;
  segments: PromiseSegment[];
  error_handlers: ErrorHandler[];
}

interface AsyncFlow {
  entry_points: string[];
  async_calls: AsyncCallInfo[];
  promise_chains: PromiseChain[];
  execution_graph: Graph<AsyncNode>;
}
```

### Detection Patterns

**Async Functions:**
```typescript
// Look for 'async' modifier
node.type === 'function_declaration' && has_async_modifier(node)
```

**Await Expressions:**
```typescript
// Look for await keyword
node.type === 'await_expression'
```

**Promise Methods:**
```typescript
// Look for .then/.catch/.finally calls
node.type === 'call_expression' && 
  node.function.type === 'member_expression' &&
  ['then', 'catch', 'finally'].includes(node.function.property)
```

### Flow Construction Algorithm
1. Identify all async functions
2. Find all await/Promise usage
3. Build local async flows per file
4. Connect flows across files using module graph
5. Identify execution patterns
6. Detect issues and anti-patterns

## Type Definitions for @ariadnejs/types

```typescript
export interface AsyncCallInfo {
  caller: string;
  callee: string;
  call_type: AsyncCallType;
  location: Location;
}

export type AsyncCallType = 
  | 'await' 
  | 'then' 
  | 'catch' 
  | 'finally' 
  | 'callback'
  | 'promise_constructor';

export interface AsyncFlow {
  async_functions: Set<string>;
  async_calls: AsyncCallInfo[];
  promise_chains: PromiseChain[];
}
```

## Success Metrics
- Can detect all async/await usage
- Can trace Promise chains completely
- Can follow async execution flows across files
- Can identify common async problems
- No false positives in sync code
- Performance impact < 15% on analysis

## References
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layers 4 & 9)
- Architecture issues: `/packages/core/ARCHITECTURE_ISSUES.md` (Issue #11)
- Related modules:
  - `/call_graph/call_chain_analysis` (needs extension)
  - `/type_analysis/type_tracking` (Promise type handling)
  - `/call_graph/function_calls` (base call detection)

## Notes
Async analysis is complex because:
- Execution order isn't always clear from syntax
- Promises can be stored and resolved later
- Error propagation follows different rules
- Concurrency makes flow non-deterministic

Start with basic detection, then add flow analysis.