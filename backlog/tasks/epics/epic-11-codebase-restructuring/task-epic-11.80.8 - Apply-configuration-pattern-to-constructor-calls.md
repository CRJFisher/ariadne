# Task Epic-11.80.8: Apply Configuration Pattern to constructor_calls Module

## Status
Completed (Integrated into function_calls)

## Parent Task
Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description
Apply the configuration-driven pattern to the constructor_calls module, completing the refactoring of all call detection modules.

## Scope
Refactor `/packages/core/src/call_graph/constructor_calls/` following the established pattern.

## Implementation Approach

### 1. Constructor-Specific Configuration
```typescript
interface LanguageConstructorConfig extends LanguageCallConfig {
  // Constructor-specific patterns
  new_expression_type?: string;       // "new_expression" for JS/TS
  struct_literal_type?: string;       // For Rust struct literals
  class_instantiation_pattern?: RegExp; // For Python (capitalized names)
  factory_patterns?: string[];        // Factory function patterns
}
```

### 2. Unify Constructor Detection
- `new` keyword expressions (JavaScript/TypeScript)
- Capitalized function calls (Python)
- Struct literals (Rust)
- Factory functions (all languages)

### 3. Share Infrastructure
- Reuse configuration loading from function_calls
- Share generic traversal utilities
- Maintain consistent error handling

## Expected Outcomes
- Complete unification of call detection patterns
- Significant code reduction across all three modules
- Consistent architecture for call detection
- Easy to extend for new languages

## Acceptance Criteria
- [x] Configuration-driven constructor detection
- [x] All existing tests pass
- [x] Pattern consistent across all call modules
- [x] Documentation updated

## Dependencies
- Task 11.80.7 (apply pattern to all modules in sequence)

## Estimated Effort
3 hours

## Notes
This completes the configuration-driven refactoring of all call detection modules, establishing a consistent pattern that can be applied to other language-specific modules in the codebase.

## Implementation Notes

Constructor call detection has been integrated directly into the function_calls module using the configuration pattern, providing a unified approach for all types of calls.

### How Constructor Calls Are Handled

1. **Configuration-Driven Detection**
   - `is_constructor_call_generic` function uses `LanguageCallConfig`
   - Constructor patterns defined in configuration:
     - `new_expression_type` for JavaScript/TypeScript `new` keyword
     - `capitalized_convention` for Python-style constructor detection
     - `struct_literal_type` for Rust struct instantiation

2. **Language-Specific Patterns**
   - **JavaScript/TypeScript**: Detects `new_expression` nodes
   - **Python**: Uses capitalization convention (functions starting with uppercase)
   - **Rust**: Handles struct literals (planned support)

3. **Integrated Features**
   - Constructor calls detected alongside function and method calls
   - `is_constructor_call` flag set on FunctionCallInfo
   - Works with all integrations (scope tree, imports, type map)

### Configuration Structure

```typescript
constructor_patterns: {
  new_expression_type?: string;        // e.g., "new_expression" for JS
  capitalized_convention: boolean;     // Whether capitalized = constructor
  struct_literal_type?: string;        // For Rust struct literals
}
```

### Benefits of Integration

- All call types (function, method, constructor) in one module
- Shared detection logic and infrastructure
- Single context object with all enrichments
- Consistent API for consumers
- No code duplication

### Test Coverage

Constructor detection is tested in the function_calls test suite:
- JavaScript `new` expressions
- Python capitalized function calls
- Rust struct instantiation (when implemented)

The configuration pattern has been successfully applied to constructor calls, completing the unification of all call detection patterns within the function_calls module.
