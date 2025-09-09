# Module Refactoring Recipe

## Overview

This recipe describes how to refactor language-specific modules to use a combination of configuration-driven generic processing and language-specific handlers.

## Step-by-Step Process

### 1. Research & Analysis Phase

**Objective:** Understand what can be genericized vs what requires language-specific logic

- Analyze all language-specific implementations
- Identify common patterns (usually 80-90% of code)
- Document truly unique language features that cannot be expressed through configuration
- Calculate percentage split (e.g., 86% generic, 14% language-specific)

**Key Questions:**

- What differs between languages? (usually just identifiers/node types)
- What logic is truly unique? (e.g., TypeScript decorators, Python comprehensions, Rust macros)

### 2. Design Configuration Schema

**Objective:** Create a configuration structure that captures all genericizable differences

```typescript
// Example structure
interface LanguageConfig {
  node_types: string[]; // AST node types to look for
  field_names: string[]; // Field names in AST nodes
  patterns: {
    // Language-specific patterns
    [key: string]: string | boolean;
  };
}
```

### 3. File Structure Planning

**Objective:** Establish the target file structure before coding

```txt
module_name/
├── index.ts                    # Just contains exports for functions and types used *outside* of this module
├── module_name.ts              # Generic processor
├── language_configs.ts        # Configuration objects for all languages
├── module_name.typescript.ts  # TypeScript bespoke features only
├── module_name.python.ts      # Python bespoke features only
├── module_name.rust.ts        # Rust bespoke features only
├── module_name.test.ts        # Tests for main API + generic processor
├── language_configs.test.ts   # Tests for configurations
├── module_name.typescript.test.ts  # TypeScript bespoke tests
├── module_name.python.test.ts      # Python bespoke tests
└── module_name.rust.test.ts        # Rust bespoke tests
```

**⚠️ CRITICAL NAMING CONVENTION ⚠️**
- **NO `.bespoke` suffix** - Files are named `module_name.language.ts` NOT `module_name.language.bespoke.ts`
- **NO `.generic` suffix** - The main file is `module_name.ts` NOT `module_name.generic.ts`
- **Language files use exact language names**: `.javascript.ts`, `.typescript.ts`, `.python.ts`, `.rust.ts`
- **Test files follow same pattern**: `module_name.language.test.ts`
- **This naming is EXACT and REQUIRED** - no variations or suffixes

### 4. Implementation Order

#### 4.1 Create Configuration Objects

- Start with `language_configs.ts`
- Define configuration interface
- Create configurations for all supported languages
- Export getLanguageConfig helper function

#### 4.2 Implement Generic Processor

- Create generic processing functions in `module_name.ts`
- Use configuration objects to drive behavior
- Export processing context interface
- Include shared constants

#### 4.3 Implement Bespoke Handlers

- Create `module_name.language.ts` files (NOT `.bespoke.ts`)
- Each file handles ONLY truly unique features
- Export specific handler functions (e.g., `handle_typescript_decorators`)
- Keep bespoke code minimal and focused
- **Remember: NO `.bespoke` suffix in filenames!**

#### 4.4 Wire Everything in index.ts

- **IMPORTANT**: index.ts should ONLY contain exports, no implementation logic
- Export types and functions from `module_name.ts`
- Export configuration functions from `language_configs.ts`
- Export bespoke functions from language files (for testing)
- NO implementation code in index.ts - it's purely an export aggregator

### 5. Test Organization

#### 5.1 Test Structure Rules

- Every code file gets a corresponding `.test.ts` file
- Tests live next to the code they test
- No separate test directories

#### 5.2 Test Migration

- Move generic processor tests → `module_name.test.ts`
- Split bespoke handler tests → individual `module_name.language.test.ts` files
- Configuration tests → `language_configs.test.ts`
- Integration tests → `module_name.test.ts`

### 6. Cleanup Phase

- Delete old language-specific implementations
- Remove deprecated test files
- Verify all tests pass
- Check for unused imports

## Anti-patterns to Avoid

1. **DON'T** pass function references as parameters

   - Bad: `{ processor: processNode }`
   - Good: Use switch statements for explicit dispatch

2. **DON'T** create a single `bespoke_handlers.ts` file

   - Each language gets its own file

3. **DON'T** put generic logic in language files

   - Language files should ONLY contain unique features to that language

4. **DON'T** duplicate logic between generic and bespoke
   - If it can be configured, it goes in generic

5. **DON'T** use `.bespoke` or `.generic` suffixes
   - Bad: `module_name.javascript.bespoke.ts`
   - Good: `module_name.javascript.ts`

## Success Criteria

- [ ] 80%+ of code is configuration-driven
- [ ] Each language file is <100 lines
- [ ] No code duplication between languages
- [ ] Tests mirror code structure exactly
- [ ] All language-specific features still work
- [ ] File sizes reduced by 50%+

## Key Insight

Most "language-specific" code isn't actually language-specific logic - it's just different names for the same concepts. By separating configuration (names) from logic (algorithms), we can dramatically reduce code duplication while maintaining language-specific accuracy.
