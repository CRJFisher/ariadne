# Task Epic-11.80.8: Apply Configuration Pattern to constructor_calls Module

## Status
Pending

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
- [ ] Configuration-driven constructor detection
- [ ] All existing tests pass
- [ ] Pattern consistent across all call modules
- [ ] Documentation updated

## Dependencies
- Task 11.80.7 (apply pattern to all modules in sequence)

## Estimated Effort
3 hours

## Notes
This completes the configuration-driven refactoring of all call detection modules, establishing a consistent pattern that can be applied to other language-specific modules in the codebase.
