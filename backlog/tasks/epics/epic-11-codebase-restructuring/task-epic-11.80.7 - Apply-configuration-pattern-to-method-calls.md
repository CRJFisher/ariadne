# Task Epic-11.80.7: Apply Configuration Pattern to method_calls Module

## Status

Completed (Integrated into function_calls)

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

- [x] Configuration-driven method call detection
- [x] All existing tests pass
- [x] Code reduction achieved
- [x] Pattern consistent with function_calls

## Dependencies

- Task 11.80.1 (proven pattern from function_calls)
- Task 11.80.2 (understanding of bespoke handling)

## Estimated Effort

3 hours (faster due to established pattern)

## Implementation Notes

Method call detection has been integrated directly into the function_calls module using the configuration pattern, rather than creating a separate method_calls module. This approach provides better code reuse and maintainability.

### How Method Calls Are Handled

1. **Configuration-Driven Detection**
   - `is_method_call_generic` function uses `LanguageCallConfig`
   - Method expression types defined in config (e.g., member_expression, field_expression, attribute)
   - Language-specific patterns handled through configuration

2. **Integrated Features**
   - Method calls detected alongside function calls
   - `is_method_call` flag set on FunctionCallInfo
   - Type resolution for methods via type_map integration (task 11.80.6)
   - Works with scope tree and import resolver

3. **Benefits of Integration**
   - Single entry point for all call detection
   - Shared infrastructure (scope resolution, import tracking, type resolution)
   - No duplicate code between function and method detection
   - Consistent API for consumers

### Configuration Fields Used

- `method_expression_types`: Types that indicate method calls
- `method_object_field`: Field containing the receiver object
- `method_property_field`: Field containing the method name

### Why Not a Separate Module?

The original plan was to create a separate method_calls module, but integration into function_calls proved more efficient:
- Methods and functions share most detection logic
- Single context object with all enrichments
- Avoided code duplication
- Simpler API for consumers

The configuration pattern has been successfully applied, achieving the goals of this task within the existing function_calls structure.
