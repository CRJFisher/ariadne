# Folder Structure Migration Rules

## Overview

This document defines the standard folder structure for refactored modules following the configuration-driven pattern.

## Standard Module Structure

Every refactored module must follow this exact structure:

```
module_name/
├── index.ts                    # ONLY exports - no implementation. Should not re-export any types or functions.
├── module_name.ts              # Generic processor with main logic
├── language_configs.ts        # Configuration objects for all languages
├── module_name.javascript.ts  # JavaScript-specific bespoke features
├── module_name.typescript.ts  # TypeScript-specific bespoke features
├── module_name.python.ts      # Python-specific bespoke features
├── module_name.rust.ts        # Rust-specific bespoke features
├── module_name.test.ts        # Tests for main API + generic processor
├── language_configs.test.ts   # Tests for configurations
├── module_name.javascript.test.ts  # JavaScript bespoke tests
├── module_name.typescript.test.ts  # TypeScript bespoke tests
├── module_name.python.test.ts      # Python bespoke tests
└── module_name.rust.test.ts        # Rust bespoke tests
```

## Critical Naming Rules

### ✅ CORRECT Naming

- `module_name.javascript.ts` - JavaScript bespoke features
- `module_name.typescript.ts` - TypeScript bespoke features
- `module_name.python.ts` - Python bespoke features
- `module_name.rust.ts` - Rust bespoke features

### ❌ INCORRECT Naming (DO NOT USE)

- `module_name.javascript.bespoke.ts` - NO `.bespoke` suffix
- `module_name.generic.ts` - NO `.generic` suffix
- `module_name.js.ts` - Use full language name `javascript`
- `module_name.ts.ts` - Use `typescript` not `ts`
- `bespoke_handlers.ts` - Each language gets its own file

## File Responsibilities

### index.ts

- **ONLY contains exports**
- No implementation logic whatsoever
- Aggregates and re-exports from other files
- Makes the module's public API clear

### module_name.ts

- Contains the main generic implementation
- Handles 80-90% of functionality through configuration
- Coordinates between configuration and bespoke handlers
- Includes the main entry point functions

### language_configs.ts

- Defines configuration interfaces
- Contains configuration objects for each language
- Exports helper functions for accessing configurations
- No implementation logic, only data

### module_name.language.ts

- Contains ONLY language-specific features that cannot be configured
- Typically 10-20% of total functionality
- Exports specific handler functions
- Should be small and focused (usually <200 lines)

## Test File Organization

### Test Coverage Requirements

- Every code file must have a corresponding test file
- Tests live next to the code they test
- No separate test directories

### Test File Mapping

- `module_name.ts` → `module_name.test.ts`
- `language_configs.ts` → `language_configs.test.ts`
- `module_name.javascript.ts` → `module_name.javascript.test.ts`
- etc.

## Language Support Detection

The presence of a test file indicates language support:

- If `module_name.python.test.ts` exists → Python is supported
- If `module_name.rust.test.ts` exists → Rust is supported
- No need for a registry or configuration

## Migration Checklist

When refactoring a module to this structure:

1. [ ] Create `language_configs.ts` with configuration objects
2. [ ] Move generic logic to `module_name.ts`
3. [ ] Extract language-specific features to `module_name.language.ts` files
4. [ ] Create `index.ts` with exports only
5. [ ] Organize tests to match code structure
6. [ ] Delete old language-specific implementations
7. [ ] Verify all tests pass
8. [ ] Ensure file naming follows convention exactly

## Example: parameter_type_inference

```
parameter_type_inference/
├── index.ts                                # Exports only
├── parameter_type_inference.ts            # Generic parameter processing
├── language_configs.ts                    # Parameter configurations
├── parameter_type_inference.javascript.ts # JSDoc, usage analysis
├── parameter_type_inference.typescript.ts # Generics, overloads
├── parameter_type_inference.python.ts     # Docstrings, type hints
├── parameter_type_inference.rust.ts       # Lifetimes, patterns
├── parameter_type_inference.test.ts       # Main tests
├── language_configs.test.ts               # Config tests
└── parameter_type_inference.javascript.test.ts # JS-specific tests
```

## Benefits

- **Consistency**: Every module follows the same structure
- **Discoverability**: Easy to find language-specific code
- **Maintainability**: Clear separation of concerns
- **Testability**: Test files mirror code structure
- **Scalability**: Easy to add new languages
