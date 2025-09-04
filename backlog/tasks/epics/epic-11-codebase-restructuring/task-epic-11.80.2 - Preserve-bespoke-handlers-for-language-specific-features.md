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

### 1. Create Bespoke Handler Interface

```typescript
interface BespokeHandlers {
  preprocessNode?: (node: SyntaxNode, context: Context) => void;
  postprocessCall?: (
    call: FunctionCallInfo,
    node: SyntaxNode
  ) => FunctionCallInfo;
  specialCases?: {
    [nodeType: string]: (
      node: SyntaxNode,
      context: Context
    ) => FunctionCallInfo | null;
  };
}
```

### 2. Register Language Handlers

```typescript
const BESPOKE_HANDLERS: Partial<Record<Language, BespokeHandlers>> = {
  typescript: {
    specialCases: {
      decorator: handle_typescript_decorator,
    },
  },
  rust: {
    specialCases: {
      macro_invocation: handle_rust_macro,
    },
  },
};
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
