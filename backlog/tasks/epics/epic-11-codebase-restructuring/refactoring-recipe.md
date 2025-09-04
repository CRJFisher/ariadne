# Module Refactoring Recipe

## Overview

This recipe describes how to refactor language-specific modules to use a combination of configuration-driven generic processing and bespoke language-specific handlers.

## Step-by-Step Process

### 1. Research & Analysis Phase

**Objective:** Understand what can be genericized vs what requires bespoke logic

- Analyze all language-specific implementations
- Identify common patterns (usually 80-90% of code)
- Document truly unique language features that cannot be expressed through configuration
- Calculate percentage split (e.g., 86% generic, 14% bespoke)

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
├── index.ts                    # Main export, combines generic + bespoke
├── module_name.ts              # Generic processor + MODULE_CONTEXT
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
- Include shared constants (e.g., MODULE_CONTEXT)

#### 4.3 Implement Bespoke Handlers

- Create `module_name.language.ts` files
- Each file handles ONLY truly unique features
- Export specific handler functions (e.g., `handle_typescript_decorators`)
- Keep bespoke code minimal and focused

#### 4.4 Wire Everything in index.ts

- Import generic processor from `module_name.ts`
- Import bespoke handlers from language files
- Combine results using explicit dispatch (switch statement)
- Export main API function and types

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

## Success Criteria

- [ ] 80%+ of code is configuration-driven
- [ ] Each language file is <100 lines
- [ ] No code duplication between languages
- [ ] Tests mirror code structure exactly
- [ ] All language-specific features still work
- [ ] File sizes reduced by 50%+

## Key Insight

Most "language-specific" code isn't actually language-specific logic - it's just different names for the same concepts. By separating configuration (names) from logic (algorithms), we can dramatically reduce code duplication while maintaining language-specific accuracy.
