# Task 155.2: Implement Type Stub Resolver

**Parent**: task-155
**Dependencies**: task-155.1 (design must be complete)
**Status**: TODO
**Priority**: High
**Estimated Effort**: 2 days

## Goal

Implement the type stub resolver that loads stub files, evaluates inference rules, and integrates with the method resolution pipeline.

## Prerequisites

Task-155.1 must be complete, providing:
- Stub file format schema (JSON)
- Inference rule DSL specification
- Transform operation semantics
- TypeScript type definitions
- Integration architecture

## Implementation Tasks

### 1. Stub Loader (0.5 day)

**Location**: `packages/core/src/resolve_references/type_stubs/stub_loader.ts`

**Functionality**:
```typescript
export interface StubRegistry {
  get_stub(language: string, method_signature: string): MethodStub | undefined;
  load_stubs(language: string): void;
}

export function create_stub_registry(): StubRegistry {
  const stubs = new Map<string, Map<string, MethodStub>>();

  return {
    load_stubs(language: string) {
      // Load from type_stubs/{language}.json
      const stub_file = read_stub_file(language);
      stubs.set(language, parse_stubs(stub_file));
    },

    get_stub(language: string, method_signature: string) {
      return stubs.get(language)?.get(method_signature);
    }
  };
}
```

**Features**:
- Load stub files from `type_stubs/` directory
- Parse JSON and validate against schema
- Cache loaded stubs in memory
- Handle missing files gracefully
- Log warnings for malformed stubs

**Error Handling**:
- Missing stub file → return empty map (don't crash)
- Invalid JSON → log error, skip file
- Unknown transform → log warning, return undefined

### 2. Inference Rule Evaluator (1 day)

**Location**: `packages/core/src/resolve_references/type_stubs/rule_evaluator.ts`

**Functionality**:
```typescript
export function evaluate_inference_rule(
  rule: InferenceRule,
  call: SymbolReference,
  context: ResolutionContext
): SymbolName | undefined {
  // 1. Resolve source
  const source_type = resolve_source(rule.from, call, context);
  if (!source_type) return undefined;

  // 2. Apply transform
  if (rule.transform) {
    return apply_transform(rule.transform, source_type, context);
  }

  return source_type;
}
```

**Source Resolution**:
```typescript
function resolve_source(
  source: SourceSpecifier,
  call: SymbolReference,
  context: ResolutionContext
): SymbolName | undefined {
  // Handle combinators first
  if (source.includes(" | ")) {
    const options = source.split(" | ");
    for (const option of options) {
      const result = resolve_source(option.trim(), call, context);
      if (result) return result;
    }
    return undefined;
  }

  // Handle specific sources
  if (source.startsWith("call_argument:")) {
    const index = parseInt(source.split(":")[1]);
    return get_argument_type(call, index, context);
  }

  if (source === "receiver") {
    return get_receiver_type(call, context);
  }

  if (source.startsWith("callback_param:")) {
    const index = parseInt(source.split(":")[1]);
    return get_callback_param_type(call, index, context);
  }

  if (source === "callback_return") {
    return get_callback_return_type(call, context);
  }

  return undefined;
}
```

**Transform Operations**:
```typescript
function apply_transform(
  transform: TransformOperation,
  type: SymbolName,
  context: ResolutionContext
): SymbolName | undefined {
  switch (transform) {
    case "identity":
      return type;

    case "element_type":
      // Array<T> → T, Vec<T> → T, list[T] → T
      return extract_generic_argument(type, 0);

    case "array_of":
      // T → Array<T>
      return `Array<${type}>`;

    case "promise_of":
      // T → Promise<T>
      return `Promise<${type}>`;

    case "resolved_type":
      // Promise<T> → T
      if (type.startsWith("Promise<")) {
        return extract_generic_argument(type, 0);
      }
      return type;

    case "option_inner":
      // Option<T> → T
      if (type.startsWith("Option<")) {
        return extract_generic_argument(type, 0);
      }
      return undefined;

    case "result_ok":
      // Result<T, E> → T
      if (type.startsWith("Result<")) {
        return extract_generic_argument(type, 0);
      }
      return undefined;

    default:
      console.warn(`Unknown transform: ${transform}`);
      return undefined;
  }
}
```

**Helper Functions**:
```typescript
function extract_generic_argument(type: SymbolName, index: number): SymbolName | undefined {
  // Extract Nth generic argument from Type<A, B, C>
  // Example: extract_generic_argument("Map<string, number>", 1) → "number"
  const match = type.match(/<([^>]+)>/);
  if (!match) return undefined;

  const args = match[1].split(",").map(s => s.trim());
  return args[index] as SymbolName | undefined;
}

function get_argument_type(call: SymbolReference, index: number, context: ResolutionContext): SymbolName | undefined {
  // Get type of Nth argument to the call
  // May need to resolve constructor calls, etc.
}

function get_receiver_type(call: SymbolReference, context: ResolutionContext): SymbolName | undefined {
  // Get type of the object the method is called on
}

function get_callback_param_type(call: SymbolReference, index: number, context: ResolutionContext): SymbolName | undefined {
  // Get type of Nth parameter in callback argument
  // This is complex - may need lambda parameter tracking
}

function get_callback_return_type(call: SymbolReference, context: ResolutionContext): SymbolName | undefined {
  // Get return type of callback argument
  // This is complex - may need lambda return type tracking
}
```

### 3. Integration with Method Resolution (0.5 day)

**Location**: `packages/core/src/resolve_references/method_resolution/resolve_method_calls.ts`

**Modify existing resolution to add Layer 2**:
```typescript
export function resolve_method_call(
  call: SymbolReference,
  context: TypeContext,
  stub_registry: StubRegistry
): SymbolResolution | undefined {
  // Layer 1: Try explicit type annotation (existing)
  const receiver_type = context.symbol_types.get(call.receiver?.symbol_id);
  if (receiver_type) {
    return resolve_via_type(receiver_type, call.name, context);
  }

  // Layer 2: Try type stub inference (NEW)
  const stub_result = try_stub_inference(call, context, stub_registry);
  if (stub_result) {
    return { resolved_symbol: stub_result, confidence: "definite" };
  }

  // Layer 3: Heuristic fallback (task-154, future)
  return undefined;
}

function try_stub_inference(
  call: SymbolReference,
  context: TypeContext,
  stub_registry: StubRegistry
): SymbolId | undefined {
  // 1. Build method signature
  const receiver_type = infer_receiver_type(call, context);
  if (!receiver_type) return undefined;

  const signature = `${receiver_type}.${call.name}`;

  // 2. Get stub
  const stub = stub_registry.get_stub(context.language, signature);
  if (!stub) return undefined;

  // 3. Evaluate inference rules
  const inferred_type = evaluate_stub(stub, call, context);
  if (!inferred_type) return undefined;

  // 4. Resolve type name to symbol
  return context.type_registry.resolve_type_to_symbol(inferred_type);
}
```

## Testing Strategy

### Unit Tests

1. **Stub Loader Tests** (`stub_loader.test.ts`)
   - Load valid stub file
   - Handle missing file
   - Handle invalid JSON
   - Cache loaded stubs

2. **Rule Evaluator Tests** (`rule_evaluator.test.ts`)
   - Each source specifier (call_argument, receiver, etc.)
   - Each transform operation (identity, element_type, etc.)
   - Combinators (A | B)
   - Edge cases (missing types, invalid transforms)

3. **Integration Tests** (`stub_integration.test.ts`)
   - Array.reduce with ReferenceBuilder (the original problem)
   - Array.map element type extraction
   - Promise.then type unwrapping
   - Each language's common patterns

### Test Data

Create minimal stub files for testing:
```json
{
  "language": "javascript",
  "stubs": {
    "Array.prototype.reduce": {
      "infer_rules": {
        "callback_param:0": {
          "from": "call_argument:1",
          "transform": "identity"
        }
      }
    }
  }
}
```

## Files to Create

1. `packages/core/src/resolve_references/type_stubs/stub_loader.ts`
2. `packages/core/src/resolve_references/type_stubs/rule_evaluator.ts`
3. `packages/core/src/resolve_references/type_stubs/helpers.ts` (shared utilities)
4. `packages/core/src/resolve_references/type_stubs/stub_loader.test.ts`
5. `packages/core/src/resolve_references/type_stubs/rule_evaluator.test.ts`
6. `packages/core/src/resolve_references/type_stubs/stub_integration.test.ts`

## Files to Modify

1. `packages/core/src/resolve_references/method_resolution/resolve_method_calls.ts`
   - Add Layer 2 (stub inference)
   - Pass stub_registry through resolution pipeline

## Acceptance Criteria

- [ ] Stub loader can load and parse JSON stub files
- [ ] All source specifiers implemented (call_argument, receiver, etc.)
- [ ] All transform operations implemented (identity, element_type, etc.)
- [ ] Combinators work (A | B fallback logic)
- [ ] Integration with method resolution pipeline complete
- [ ] Unit tests pass for all components
- [ ] Integration test passes for Array.reduce case
- [ ] Error handling gracefully degrades (no crashes)
- [ ] Performance acceptable (<10ms overhead per resolution)

## Success Criteria

The original problem from `reference_builder.ts` should resolve:
```typescript
.reduce(
  (builder, capture) => builder.process(capture),
  new ReferenceBuilder(context, extractors, file_path)
)
```

After this task:
- `builder` type correctly inferred as `ReferenceBuilder`
- `builder.process(capture)` resolves to `ReferenceBuilder.process()`
- No longer appears as unresolved entry point in call graph

## Notes

- Start simple: Implement basic cases first, add complexity incrementally
- Test each component in isolation before integration
- Profile performance - this is in hot path of method resolution
- Document all edge cases and limitations
- Consider logging/debugging output for development
