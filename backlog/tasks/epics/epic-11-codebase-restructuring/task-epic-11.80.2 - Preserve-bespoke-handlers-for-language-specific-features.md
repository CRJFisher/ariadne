# Task Epic-11.80.2: Preserve Bespoke Handlers for Language-Specific Features

## Status

Pending

## Parent Task

Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description

Identify and preserve truly language-specific logic that cannot be expressed through configuration, creating a clean interface between generic and bespoke processing.

## Scope

Focus on the ~14% of code that requires algorithmic differences between languages.

## Bespoke Features to Preserve

### TypeScript

- **Decorator calls**: Complex parsing of decorator syntax
- **Type assertions**: Handling of `as` expressions in call chains

### Rust

- **Macro invocations**: Token tree parsing and argument counting
- **Impl context**: Understanding impl blocks for method naming
- **Unsafe blocks**: Special handling for unsafe function calls

### Python

- **Comprehensions**: List/dict/set comprehensions with calls
- **Class instantiation**: Capitalization-based constructor detection

### JavaScript

- **Constructor detection**: `new` expression handling
- **Promise chains**: `.then()`, `.catch()` pattern detection

## Implementation Approach

### 1. Create Bespoke Processing Structure

```typescript
// Instead of function references, use explicit dispatch
function process_bespoke_node(
  node: SyntaxNode,
  context: Context,
  language: Language
): FunctionCallInfo | null {
  // Direct switch statements for static analysis
  switch (language) {
    case 'typescript':
      if (node.type === 'decorator') {
        return handle_typescript_decorator(node, context);
      }
      break;
    case 'rust':
      if (node.type === 'macro_invocation') {
        return handle_rust_macro(node, context);
      }
      break;
  }
  return null;
}
```

### 2. Language-Specific Files

```typescript
// function_calls.typescript.ts
export function handle_typescript_decorator(
  node: SyntaxNode,
  context: Context
): FunctionCallInfo | null {
  // Implementation
}

// function_calls.rust.ts  
export function handle_rust_macro(
  node: SyntaxNode,
  context: Context
): FunctionCallInfo | null {
  // Implementation
}
```

## Acceptance Criteria

- [ ] All language-specific features continue to work
- [ ] Clear separation between configuration and bespoke logic
- [ ] Bespoke handlers are well-documented
- [ ] Test coverage for each bespoke feature

## Dependencies

- Task 11.80.1 (configuration extraction must be complete)

## Estimated Effort

3 hours
