# Task: Update JavaScript Language Config

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
Update the JavaScript language configuration file to support the unified context approach by removing separate modifiers and merging everything into a single context function.

## File
`packages/core/src/parse_and_query_code/language_configs/javascript.ts`

## Implementation Checklist

### CRITICAL: Remove Modifiers Function Entirely
- [ ] Remove `modifiers` field from ALL CaptureMapping entries
- [ ] CaptureMapping interface should only have `context` function (not `modifiers`)

### Merge All Logic into Context Function
- [ ] Move `is_async` detection into context function
- [ ] Move `is_generator` detection into context function
- [ ] Move `visibility` mapping into context function
- [ ] Move `is_awaited` detection into context function
- [ ] Move `is_iterated` detection into context function

### Update Context to Support 14 Fields Total
- [ ] Import fields (4): source, imported_symbol, local_name, import_type
- [ ] Export fields (3): exported_as, export_type, reexport_source
- [ ] Definition fields (5): extends, type_name, visibility, is_async, is_generator
- [ ] Relationship fields (2): is_awaited, is_iterated

### Remove Unused Context Fields
- [ ] Remove all SyntaxNode references (receiver_node, target_node, etc.)
- [ ] Remove property_chain, type_arguments, parameter_name, return_type
- [ ] Remove complex nested objects

## Code Example
```typescript
// BEFORE: Separate modifiers and context functions
const jsConfig: LanguageCaptureConfig = new Map([
  ["function.name", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.FUNCTION,
    modifiers: (node) => ({
      is_async: node.parent?.type === 'async_function',
      visibility: 'public'
    }),
    context: (node) => ({
      exported_as: findExportName(node),
      export_type: findExportType(node)
    })
  }]
]);

// AFTER: Single unified context function
const jsConfig: LanguageCaptureConfig = new Map([
  ["function.name", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.FUNCTION,
    context: (node) => ({
      // Merged modifier fields
      is_async: node.parent?.type === 'async_function',
      visibility: 'public',
      // Existing context fields
      exported_as: findExportName(node),
      export_type: findExportType(node)
    })
  }]
]);
```

## Visibility Mapping (in context)
- Default: 'public' (no keyword)
- Private: '#' prefix → 'private'
- Protected: Not supported in JS → N/A

## Async/Generator Detection (in context)
- `async function` → is_async: true
- `function*` → is_generator: true
- Arrow functions → Check for async keyword
- `await` calls → is_awaited: true
- `for...of` loops → is_iterated: true

## Testing Notes
- Ensure context is ALWAYS non-null (return {} if empty)
- Verify all modifier logic moved to context function
- No modifiers function should remain in any mapping
- Test with various import/export patterns