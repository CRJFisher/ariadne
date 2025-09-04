# Task Epic-11.80.7: Apply Configuration Pattern to method_calls Module

## Status

Pending

## Parent Task

Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description

Apply the proven configuration-driven pattern from function_calls to the method_calls module, achieving similar code reduction and maintainability improvements.

## Scope

Refactor `/packages/core/src/call_graph/method_calls/` using lessons learned from function_calls refactoring.

## Implementation Approach

### 1. Extend Configuration Structure

```typescript
interface LanguageMethodConfig extends LanguageCallConfig {
  // Method-specific configurations
  property_access_types: string[];
  static_method_indicators: string[];
  chained_call_separator: string; // "." for most, "::" for Rust
  self_keywords: string[]; // ["this", "self", "me"]
}
```

### 2. Reuse Generic Infrastructure

- Leverage generic processors from function_calls
- Share configuration objects where possible
- Maintain consistency with function_calls patterns

### 3. Handle Method-Specific Features

- Instance vs static method detection
- Method chaining
- Self/this references
- Super calls

## Expected Outcomes

- ~60% code reduction (similar to function_calls)
- Consistent processing across languages
- Easier to add new language support
- Shared infrastructure with function_calls

## Acceptance Criteria

- [ ] Configuration-driven method call detection
- [ ] All existing tests pass
- [ ] Code reduction achieved
- [ ] Pattern consistent with function_calls

## Dependencies

- Task 11.80.1 (proven pattern from function_calls)
- Task 11.80.2 (understanding of bespoke handling)

## Estimated Effort

3 hours (faster due to established pattern)
