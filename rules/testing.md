# Testing Standards

## Core Principles

### 1. Fix Issues, Don't Hide Them

When a test fails:

- **Never** modify the test just to make it pass
- **Either** fix the underlying issue immediately
- **Or** create a task to address it properly

### 2. Test All Supported Languages

For any feature or fix:

- Verify tests exist for JavaScript, TypeScript, Python, and Rust
- Add missing language tests before marking task complete
- Each language may have unique edge cases - test them
- **Test file existence = language support** (no separate registry needed)

### 3. Contract-Based Testing

For features in the new structure:

- **Define test contracts** that all languages must implement
- **Required tests** must pass for all supported languages
- **Optional tests** can be language-specific
- **Test interface** ensures comprehensive coverage

```typescript
// Example: feature.contract.ts
export interface FeatureTestContract {
  testBasicUsage(): void;      // Required
  testEdgeCases(): void;        // Required
  testLanguageSpecific?(): void; // Optional
}
```

### 4. Test Real Behavior

- Test actual functionality, not implementation details
- Use real code samples from actual projects
- Avoid mocking unless absolutely necessary
- **Language fixtures** should represent idiomatic code

### 5. Maintain Test Health

- Run full test suite before committing
- Fix flaky tests immediately - they erode trust
- Keep test files under 32KB (tree-sitter limit)
- **Validate contract compliance** with automated scripts

### 6. Document Test Gaps

When you find untested code:

- Add a test if quick (< 10 minutes)
- Otherwise create a task with specific examples
- When completing a task, document any test gaps you found in its Implementation Notes section
- **Mark features as partial support** when limitations exist

## Testing Structure

### Feature-Based Organization

Tests follow the feature structure:

```
src/[feature_category]/[feature]/
├── [feature].contract.ts          # Test contract definition
├── [feature].test.ts              # Shared test utilities
├── [feature].javascript.test.ts   # JS implementation
├── [feature].typescript.test.ts   # TS implementation
├── [feature].python.test.ts       # Python implementation
└── [feature].rust.test.ts         # Rust implementation
```

### Contract Validation

Run validation to ensure compliance:

```bash
# Validate specific feature
npm run validate:feature [feature_name]

# Validate all features
npm run validate:features

# Generate missing test stubs
npm run generate:test-stubs
```

## Quick Checklist

Before marking any task complete:

- [ ] All tests passing
- [ ] New tests added for the change
- [ ] All supported languages covered
- [ ] Test contracts defined (for new features)
- [ ] Contract compliance validated
- [ ] No test shortcuts taken
- [ ] Test files within size limits
- [ ] Feature documentation updated
