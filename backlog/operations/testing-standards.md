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

### 3. Test Real Behavior

- Test actual functionality, not implementation details
- Use real code samples from actual projects
- Avoid mocking unless absolutely necessary

### 4. Maintain Test Health

- Run full test suite before committing
- Fix flaky tests immediately - they erode trust
- Keep test files under 32KB (tree-sitter limit)

### 5. Document Test Gaps

When you find untested code:

- Add a test if quick (< 10 minutes)
- Otherwise create a task with specific examples
- When completing a task, document any test gaps you found in its Implementation Notes section

## Quick Checklist

Before marking any task complete:

- [ ] All tests passing
- [ ] New tests added for the change
- [ ] All supported languages covered
- [ ] No test shortcuts taken
- [ ] Test files within size limits
