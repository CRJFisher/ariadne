# Task Epic-11.80.1: Extract Language Configurations and Create Generic Processor

## Status

Pending

## Parent Task

Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description

Extract language-specific identifiers (node types, field names) into configuration objects and create a generic processor that uses these configurations instead of separate implementations.

## Scope

Focus solely on the configuration extraction and generic processing for `function_calls` module. Do not integrate enhanced data structures yet.

## Implementation Details

### 1. Create Configuration Structure

```typescript
// In function_calls/language_configs.ts
export interface LanguageCallConfig {
  // Core call detection
  call_expression_types: string[];
  function_field: string;
  arguments_field: string;

  // Method call detection
  method_expression_types: string[];
  method_object_field: string;
  method_property_field: string;

  // Function definitions
  function_definition_types: string[];
  function_name_fields: string[];
}

export const LANGUAGE_CONFIGS: Record<Language, LanguageCallConfig> = {
  javascript: {
    /* ... */
  },
  typescript: {
    /* ... */
  },
  python: {
    /* ... */
  },
  rust: {
    /* ... */
  },
};
```

### 2. Create Generic Processors

- `find_function_calls_generic()` - Uses configuration for call detection
- `extract_callee_name_generic()` - Uses configuration for name extraction
- `get_enclosing_function_generic()` - Uses configuration for context detection

### 3. Update Dispatcher

Modify `index.ts` to use generic processor with configuration fallback to language-specific for bespoke features.

## Acceptance Criteria

- [ ] Configuration object contains all language-specific identifiers
- [ ] Generic processor handles 80%+ of existing functionality
- [ ] All existing tests pass without modification
- [ ] Performance remains comparable (no significant regression)

## Estimated Effort

4 hours

## Dependencies

None - this is the foundational change
