# Task 155: Type Flow Inference Through Built-in Methods

**Status**: TODO
**Priority**: High
**Estimated Effort**: 5-7 days
**Epic**: Core type resolution improvements

## Problem

When types flow through built-in third-party methods (like `Array.reduce`, `Promise.then`, `Iterator.map`), we cannot resolve them because:

1. Built-in implementations don't exist as parseable files (or are too large to parse)
2. Generic type parameters flow through these methods in predictable but complex ways
3. This causes legitimate method calls to appear as unresolved entry points

### Example

```typescript
.reduce(
  (builder, capture) => builder.process(capture),
  new ReferenceBuilder(context, extractors, file_path)
)
```

Here, `builder`'s type is `ReferenceBuilder` (from the initialValue), but we can't detect this without understanding `Array.reduce`'s type signature.

## Design Philosophy

**Critical constraint**: We will NOT use LSP integration because:
- LSPs require complex configuration (python envs, node_modules, cargo, etc.)
- Defeats the purpose of this library: syntax-based analysis that works without compiled environments
- Tree-sitter approach is self-contained and fast - adding LSP undermines this

**Instead**: Declarative type stubs that describe inference rules for common built-ins.

## Approach: Type Stub System

Create a lightweight, declarative system for describing how types flow through built-in methods:

```typescript
// type_stubs/javascript.json
{
  "Array.prototype.reduce": {
    "infer_rules": {
      // Callback's first parameter gets type from reduce's second argument (initialValue)
      "callback_param:0": {
        "from": "call_argument:1",
        "transform": "identity"
      },
      // Return type = callback return type OR initialValue type
      "return": {
        "from": "callback_return | call_argument:1"
      }
    }
  },
  "Array.prototype.map": {
    "infer_rules": {
      // Callback's first parameter is array element type
      "callback_param:0": {
        "from": "receiver",
        "transform": "element_type"
      },
      // Return type is Array<callback_return_type>
      "return": {
        "from": "callback_return",
        "transform": "array_of"
      }
    }
  },
  "Promise.prototype.then": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "resolved_type"
      }
    }
  }
}
```

This is **data-driven** - no hardcoded logic for each built-in.

## Sub-Tasks

1. **task-155.1**: Design type stub system architecture (1 day)
   - Define stub schema (JSON format)
   - Design inference rule DSL
   - Plan how stubs integrate with existing type resolution

2. **task-155.2**: Implement type stub resolver (2 days)
   - Build stub parser
   - Implement inference rule evaluator
   - Integrate with method resolution pipeline

3. **task-155.3**: JavaScript built-in stubs (1 day)
   - Array: `map`, `filter`, `reduce`, `find`, `forEach`, `flatMap`
   - Promise: `then`, `catch`, `finally`
   - Map/Set: `forEach`, `map` (where applicable)
   - Object: `keys`, `values`, `entries`

4. **task-155.4**: TypeScript utility type stubs (0.5 day)
   - `Pick<T, K>`, `Omit<T, K>`, `Partial<T>`, `Required<T>`
   - `Record<K, V>`, `Exclude<T, U>`, `Extract<T, U>`
   - These affect property access patterns

5. **task-155.5**: Python built-in stubs (1 day)
   - `list`: `map`, `filter`, comprehensions (if feasible)
   - `dict`: `get`, `items`, `keys`, `values`
   - `Optional`, `Union` type flow
   - `Iterator` protocol methods

6. **task-155.6**: Rust std trait stubs (1 day)
   - `Iterator` trait: `map`, `filter`, `fold`, `collect`
   - `Option<T>`: `map`, `and_then`, `unwrap_or`
   - `Result<T, E>`: `map`, `and_then`, `unwrap_or`
   - `Vec<T>`: `iter`, `iter_mut`, `into_iter`

7. **task-154**: Heuristic method resolution fallback (EXISTING TASK)
   - Update to be a sub-task of this parent task
   - When stubs don't match, fall back to name-based heuristics
   - Rank candidates by confidence

8. **task-155.8**: Return multiple candidate resolutions (0.5 day)
   - When ambiguous, return array of candidates instead of single result
   - Include confidence scores
   - Let caller decide which to use (or use all for exploratory analysis)

## Architecture

```
Method Call Resolution Pipeline:
1. Try direct symbol resolution (existing)
2. Try type stub inference (NEW - this task)
3. Try heuristic matching (task-154)
4. Return candidates with confidence scores (task-155.8)
```

## Success Criteria

- [ ] Stub system can handle `Array.reduce` case from the problem description
- [ ] `builder.process(capture)` resolves correctly in reduce callback
- [ ] Stubs cover top 20 most common built-in methods per language
- [ ] Fallback to heuristics when stubs don't apply
- [ ] Multiple candidates returned for ambiguous cases
- [ ] No LSP dependencies required
- [ ] Performance: <10ms overhead per method resolution

## Out of Scope

- **LSP integration**: Explicitly rejected due to configuration complexity
- **Third-party library stubs**: Only built-ins (standard library)
- **Full type inference**: Only type *flow* through known patterns
- **User annotations**: No manual override system (may add later if needed)

## Notes

This task directly addresses the unresolved `process()` call found in `analysis_output/packages-core-analysis_2025-10-23_16-16-20-655Z.json:28-38`.

The key insight: We don't need to parse `Array.reduce`'s generic type signature if we can declaratively describe how types flow through it. The stub system captures these patterns as data.
