# Task: Update JavaScript Tests

## Status: Created

## Parent Task
task-epic-11.102.1 - Update JavaScript Capture Logic for Unified Context

## ⚠️ PREREQUISITE: Read Parent Task Mapping Plan

**BEFORE STARTING THIS TASK**:
1. Open the parent task: `task-epic-11.102.1-Update-JavaScript-capture-logic.md`
2. Read the complete "JavaScript Feature → NormalizedCapture Mapping Plan" section
3. Keep the mapping tables open for reference during implementation
4. Follow the mappings EXACTLY as specified - do not deviate

## Objective
Update JavaScript tests to verify the unified context approach works correctly according to the mappings defined in the parent task.

## File
`packages/core/src/parse_and_query_code/language_configs/javascript.test.ts`

## Implementation Checklist

### CRITICAL: Update Test Structure for Unified Context
- [ ] Remove ALL tests that check for separate `modifiers` field
- [ ] Update ALL tests to expect modifier data in `context` field
- [ ] Verify NormalizedCapture has NO `modifiers` field

### Test Unified Context Structure (14 fields total)
- [ ] Context always non-null (never undefined)
- [ ] Import fields (4): source, imported_symbol, local_name, import_type
- [ ] Export fields (3): exported_as, export_type, reexport_source
- [ ] Definition fields (5): extends, type_name, visibility, is_async, is_generator
- [ ] Relationship fields (2): is_awaited, is_iterated

### Former Modifier Tests (now in context)
- [ ] Test is_async in context (not modifiers)
- [ ] Test is_generator in context (not modifiers)
- [ ] Test visibility in context ('public'/'private')
- [ ] Test is_awaited in context for await expressions
- [ ] Test is_iterated in context for for...of loops

### Remove Deprecated Tests
- [ ] Remove tests for separate `modifiers` object
- [ ] Remove tests checking `capture.modifiers.xxx`
- [ ] Remove tests for deprecated fields (is_static, is_method, etc.)
- [ ] Remove tests for old context fields (parameter_name, return_type, etc.)

### Context Always Non-null Tests
- [ ] Verify context is never null/undefined in ANY capture
- [ ] Test that empty context returns {} instead of null
- [ ] Test context structure is consistent

## Test Examples

```typescript
// OLD: Tests expecting separate modifiers
expect(capture.modifiers.is_async).toBe(true); // REMOVE
expect(capture.modifiers.visibility).toBe('public'); // REMOVE
expect(capture.context.exported_as).toBe('func'); // KEEP

// NEW: Tests expecting unified context
expect(capture.modifiers).toBeUndefined(); // Should not exist
expect(capture.context.is_async).toBe(true); // Moved to context
expect(capture.context.visibility).toBe('public'); // Moved to context
expect(capture.context.exported_as).toBe('func'); // Stays in context

// Context never null
expect(capture.context).not.toBeNull();
expect(capture.context).not.toBeUndefined();
expect(typeof capture.context).toBe('object');

// Test all possible context fields work
describe('Unified Context Fields', () => {
  test('import fields', () => {
    expect(capture.context.source).toBe('./module');
    expect(capture.context.imported_symbol).toBe('func');
    expect(capture.context.local_name).toBe('localFunc');
    expect(capture.context.import_type).toBe('named');
  });

  test('export fields', () => {
    expect(capture.context.exported_as).toBe('func');
    expect(capture.context.export_type).toBe('named');
    expect(capture.context.reexport_source).toBe('./other');
  });

  test('definition fields', () => {
    expect(capture.context.extends).toBe('BaseClass');
    expect(capture.context.type_name).toBe('string');
    expect(capture.context.visibility).toBe('public');
    expect(capture.context.is_async).toBe(true);
    expect(capture.context.is_generator).toBe(true);
  });

  test('relationship fields', () => {
    expect(capture.context.is_awaited).toBe(true);
    expect(capture.context.is_iterated).toBe(true);
  });
});
```

## Testing Coverage Checklist
- [ ] No tests reference `capture.modifiers` (should not exist)
- [ ] All former modifier fields tested in context
- [ ] All 14 context fields covered when applicable
- [ ] Context is always non-null
- [ ] Import/export patterns work with unified context
- [ ] Visibility enum works in context ('public'/'private')
- [ ] Async/generator detection works in context