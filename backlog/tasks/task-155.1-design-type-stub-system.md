# Task 155.1: Design Type Stub System Architecture

**Parent**: task-155
**Status**: TODO
**Priority**: High
**Estimated Effort**: 1 day

## Goal

Design the declarative type stub system that describes how types flow through built-in methods, without requiring LSP integration or parsing third-party code.

## Problem

When types flow through built-in methods like `Array.reduce`, `Promise.then`, or `Iterator.map`, we need to know:
1. Which parameter gets which type
2. What transformations apply (e.g., array element type)
3. What the return type is

We can't parse built-in implementations (they're too large or don't exist as files), and we've rejected LSP integration due to configuration complexity.

## Solution: Declarative Stub Schema

Design a JSON schema that describes inference rules for built-in methods.

### Example Stubs

```json
{
  "Array.prototype.reduce": {
    "infer_rules": {
      "callback_param:0": {
        "from": "call_argument:1",
        "transform": "identity"
      },
      "return": {
        "from": "callback_return | call_argument:1"
      }
    }
  },
  "Array.prototype.map": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "element_type"
      },
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
      },
      "return": {
        "from": "callback_return",
        "transform": "promise_of"
      }
    }
  }
}
```

## Design Decisions to Make

### 1. Stub File Format

**Options:**
- JSON (easy to parse, standard)
- YAML (more readable, comments)
- TypeScript DSL (type-safe, but requires compilation)

**Recommendation**: JSON for simplicity and universality

**File structure:**
```
type_stubs/
├── javascript.json
├── typescript.json
├── python.json
└── rust.json
```

### 2. Inference Rule DSL

Define mini-language for describing type transformations:

**Source specifiers:**
- `call_argument:N` - Nth argument to the method call
- `receiver` - The object the method is called on
- `callback_param:N` - Nth parameter of callback argument
- `callback_return` - Return type of callback

**Transform operations:**
- `identity` - Pass through unchanged
- `element_type` - Extract element type from array/collection
- `array_of` - Wrap in array type
- `promise_of` - Wrap in Promise type
- `resolved_type` - Unwrap Promise type
- `option_inner` - Unwrap Option<T> to T (Rust)
- `result_ok` - Extract Ok type from Result<T, E> (Rust)

**Combinators:**
- `A | B` - Try A, fallback to B
- `A & B` - Intersection (future)

### 3. Type Matching

How do we match method calls to stubs?

**Options:**
1. **Exact match**: `Array.prototype.reduce`
2. **Pattern match**: `*.reduce` (any prototype)
3. **Type-based**: Match by receiver type

**Recommendation**: Start with exact match, add patterns later

### 4. Multi-Language Support

Each language has different built-ins:
- JavaScript: `Array.prototype.*`
- Python: `list.*`, module-level functions
- Rust: `Iterator::*` trait methods

**Design:**
```json
{
  "language": "javascript",
  "stubs": {
    "Array.prototype.reduce": { ... }
  }
}
```

Or separate files (recommended):
```
javascript.json
python.json
rust.json
```

### 5. Error Handling

What if:
- Stub references non-existent argument?
- Transform doesn't apply to type?
- Circular inference?

**Design:**
- Graceful degradation: return undefined if inference fails
- Log warnings for debugging
- Don't crash - just skip to next layer (heuristics)

### 6. Integration Points

Where does stub resolution fit in the pipeline?

```typescript
// In method_resolution.ts
function resolve_method_call(call: SymbolReference, context: TypeContext) {
  // Layer 1: Try explicit type annotation
  const explicit_type = get_explicit_type(call.receiver, context);
  if (explicit_type) return resolve_via_type(explicit_type, call.name);

  // Layer 2: Try type stub inference (NEW)
  const stub_result = try_stub_inference(call, context);
  if (stub_result) return stub_result;

  // Layer 3: Try heuristic fallback (task-154)
  return heuristic_fallback(call, context);
}
```

## Deliverables

1. **Schema Definition** (JSON Schema or TypeScript types)
   - Define stub file format
   - Define inference rule syntax
   - Document all transform operations

2. **Architecture Document** (markdown)
   - How stubs are loaded
   - How inference rules are evaluated
   - Integration with existing type resolution
   - Error handling strategy

3. **Example Stubs** (3-5 examples)
   - `Array.reduce` (complex - multiple sources)
   - `Array.map` (element type extraction)
   - `Promise.then` (type unwrapping)
   - Show how each rule is applied

4. **TypeScript Type Definitions**
   ```typescript
   // type_stub_schema.ts
   export interface TypeStub {
     language: string;
     stubs: Record<string, MethodStub>;
   }

   export interface MethodStub {
     infer_rules: Record<string, InferenceRule>;
   }

   export interface InferenceRule {
     from: SourceSpecifier;
     transform?: TransformOperation;
   }

   export type SourceSpecifier =
     | `call_argument:${number}`
     | "receiver"
     | `callback_param:${number}`
     | "callback_return"
     | string; // For combinators like "A | B"

   export type TransformOperation =
     | "identity"
     | "element_type"
     | "array_of"
     | "promise_of"
     | "resolved_type"
     | "option_inner"
     | "result_ok";
   ```

5. **Test Plan** (describe, don't implement)
   - How to test stub loading
   - How to test rule evaluation
   - How to test integration with resolution

## Acceptance Criteria

- [ ] Stub file format defined (JSON schema)
- [ ] Inference rule DSL designed and documented
- [ ] Transform operations enumerated with clear semantics
- [ ] TypeScript type definitions created
- [ ] Architecture document written
- [ ] 3-5 example stubs provided
- [ ] Integration points identified
- [ ] Error handling strategy documented
- [ ] Reviewed and approved

## Open Questions

1. **Performance**: Should stubs be cached? Loaded lazily?
2. **Extensibility**: Should users be able to add custom stubs?
3. **Versioning**: Do stubs need version compatibility (language version changes)?
4. **Debugging**: How to debug why a stub didn't match?

## Files to Create

1. `packages/core/src/resolve_references/type_stubs/schema.ts` - TypeScript types
2. `docs/type-stub-system.md` - Architecture document
3. `type_stubs/` - Directory for stub files (examples only for now)

## Success Criteria

This task is complete when:
- Another developer can implement task-155.2 from this design
- The schema is clear and unambiguous
- Transform operations cover common built-in patterns
- Integration points are well-defined

## Notes

This is pure design work - no implementation. The goal is to have a clear, documented design that task-155.2 can implement without ambiguity.
