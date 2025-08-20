# Architecture Refinements Based on Namespace Imports Review

## Proposed Additions to Architecture.md

### 1. Clarify Metadata Structure

Add to the **Marshaling Pattern** section:

```typescript
// Standard metadata structure for all features
interface LanguageMetadata {
  language: 'javascript' | 'typescript' | 'python' | 'rust';
  file_path: string;
  // Additional context can be added as needed
}
```

### 2. Enhancement Pattern for Language-Specific Logic

Add a new subsection under **Marshaling Pattern**:

#### Language Enhancement Pattern

When language-specific processing enhances common logic:

```typescript
export function process_feature(
  input: Input,
  config: Config,
  metadata: LanguageMetadata
): Result {
  // Step 1: Common processing
  const common_result = process_common(input, config, metadata);
  
  // Step 2: Get language processor
  const processor = processors[metadata.language];
  if (!processor) {
    return common_result; // Fallback to common-only
  }
  
  // Step 3: Language enhancement (receives common result)
  return processor(input, config, metadata, common_result);
}
```

Language functions receive common results as their last parameter for enhancement.

### 3. Strict No-Detection Rule

Add to **Key Architectural Rules**:

6. **No language detection in features** - Language is always passed via metadata
7. **File extension mapping is centralized** - Only `scope_queries/loader.ts` maps extensions to languages

### 4. Test Implementation Pattern

Expand the **Test Contract Pattern** section:

```typescript
// [feature].javascript.test.ts - Language test implementation
import { describe, it, expect } from 'vitest';
import type { FeatureTestContract } from './test.contract';

describe('JavaScript Feature Tests', () => {
  // Implement all required tests
  it('should handle basic case', () => {
    test_basic_case();
  });
  
  // Helper to implement contract
  function test_basic_case(): void {
    const metadata: LanguageMetadata = {
      language: 'javascript',
      file_path: 'test.js'
    };
    
    const result = process_feature(input, config, metadata);
    expect(result).toBeDefined();
  }
});
```

### 5. Common Processing Guidelines

Add clarification about what belongs in `common.ts`:

#### Common vs Language-Specific

**Common logic (`common.ts`)** includes:
- Patterns that work identically for 3+ languages
- Default/fallback behavior
- Shared utilities (path normalization, etc.)
- Generic AST traversal

**Language-specific logic** includes:
- Syntax-specific patterns
- Language-unique features
- Different semantics for same syntax
- Language-specific optimizations

### 6. Approach Groups Clarification

Expand the **Case 1b** example:

```typescript
// prototype_approach.ts - Shared by JS/TS
export function resolve_prototype_based(
  ast: ASTNode,
  metadata: LanguageMetadata,
  common_result: CommonResult
): Result {
  // Implementation for prototype-based languages
}

// [feature].javascript.ts
export function process_javascript(
  ast: ASTNode,
  config: Config,
  metadata: LanguageMetadata,
  common_result: CommonResult
): Result {
  // Use the prototype approach
  const prototype_result = resolve_prototype_based(ast, metadata, common_result);
  
  // Add JavaScript-specific adjustments if needed
  return enhance_for_javascript(prototype_result);
}
```

## Anti-Patterns to Document

Add a new section **Anti-Patterns to Avoid**:

### ❌ Class-Based APIs
```typescript
// WRONG
export class FeatureAPI {
  static process() { }
}
```

### ❌ Registry Pattern
```typescript
// WRONG
Registry.register('javascript', processor);
const proc = Registry.get(language);
```

### ❌ Language Detection in Features
```typescript
// WRONG
function process(file_path: string) {
  const language = detect_language(file_path);
}
```

### ❌ Stateful Processing
```typescript
// WRONG
class Processor {
  private state: State;
  process() { /* uses this.state */ }
}
```

### ✅ Correct Pattern
```typescript
// RIGHT
export function process_feature(
  input: Input,
  config: Config,
  metadata: LanguageMetadata
): Result {
  // Pure function with explicit parameters
}
```

## Documentation Improvements

### 1. Add Migration Example

Show how to migrate from class-based to functional:

**Before:**
```typescript
class FeatureResolver extends BaseResolver {
  resolve(input: Input): Result {
    const language = this.detectLanguage();
    return this.processForLanguage(language, input);
  }
}
```

**After:**
```typescript
export function resolve_feature(
  input: Input,
  metadata: LanguageMetadata
): Result {
  const resolver = resolvers[metadata.language];
  return resolver ? resolver(input, metadata) : resolve_common(input, metadata);
}
```

### 2. Clarify Naming Conventions

- Functions: `snake_case`
- Types/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `feature_name.language.ts`

## Implementation Checklist

When implementing a new feature:

- [ ] Create `index.ts` with dispatcher pattern
- [ ] Create `common.ts` with shared logic
- [ ] Create `test.contract.ts` with test interface
- [ ] For each supported language:
  - [ ] Create `[feature].[language].ts`
  - [ ] Create `[feature].[language].test.ts`
  - [ ] Add to dispatcher mapping
- [ ] No classes used
- [ ] No language detection
- [ ] Metadata passed to all functions
- [ ] Snake_case for all functions
- [ ] Pure functions only