# Task: Update JavaScript Capture Logic for Unified Context

## Status: Created

## Parent Task
task-epic-11.102 - Audit and Remove Unnecessary Semantic Modifiers and CaptureContext Fields

## Objective
Update JavaScript language configuration to support the new unified context approach with 14 total context fields and ensure all tests pass.

## ⚠️ CRITICAL: Complete Mapping Plan First

**THIS SECTION MUST BE COMPLETED BEFORE STARTING ANY SUB-TASKS**

Before implementing any changes in sub-tasks, create a comprehensive mapping plan below that documents exactly how every JavaScript language feature maps to the new unified context structure. All sub-tasks MUST read and follow this plan.

## JavaScript Feature → NormalizedCapture Mapping Plan

### Core Structure Mapping
```typescript
interface NormalizedCapture {
  category: SemanticCategory;    // From capture type
  entity: SemanticEntity;        // From AST node type
  node_location: Location;       // From node position
  symbol_name: SymbolName;       // Symbol being captured
  context: CaptureContext;       // ALWAYS non-null, unified context (14 fields)
  // modifiers: REMOVED - merged into context
}

interface CaptureMapping {
  category: SemanticCategory;
  entity: SemanticEntity;
  context?: (node: SyntaxNode) => CaptureContext;
  // modifiers: REMOVED - no separate modifiers function
}
```

### Unified Context Fields (14 total)

**Import fields (4 fields):**
| JavaScript Feature | Context Field | Example Value | Notes |
|-------------------|--------------|---------------|-------|
| import from 'module' | `source` | 'module' | Source module path |
| import { name } | `imported_symbol` | 'name' | Original export name |
| import as alias | `local_name` | 'alias' | Local alias if different |
| import type | `import_type` | 'default'/'named'/'namespace' | Import style |

**Export fields (3 fields):**
| JavaScript Feature | Context Field | Example Value | Notes |
|-------------------|--------------|---------------|-------|
| export { name } | `exported_as` | 'name' | Export name |
| export default | `export_type` | 'default' | Export style |
| export { x } from 'y' | `reexport_source` | 'y' | For reexports only |

**Definition attributes (5 fields):**
| JavaScript Feature | Context Field | Example Value | Notes |
|-------------------|--------------|---------------|-------|
| extends BaseClass | `extends` | 'BaseClass' | For classes only |
| Variable/param/return type | `type_name` | 'Type' | For any type annotation |
| Class private method (#) | `visibility` | 'private' | Only for # prefix, else 'public' |
| async function/method | `is_async` | true | From async keyword |
| function*/generator | `is_generator` | true | From function* syntax |

**Relationships (2 fields):**
| JavaScript Feature | Context Field | Example Value | Notes |
|-------------------|--------------|---------------|-------|
| await expression | `is_awaited` | true | At call site only |
| for...of loop | `is_iterated` | true | At usage site only |

### Entity Mapping

| JavaScript Node Type | SemanticEntity | Notes |
|--------------------|----------------|-------|
| function_declaration | FUNCTION | Top-level function |
| arrow_function | FUNCTION | Arrow function |
| method_definition | METHOD | Class method |
| constructor | CONSTRUCTOR | Class constructor |
| class_declaration | CLASS | Class definition |
| variable_declarator | VARIABLE | let/const/var |
| import_specifier | IMPORT | Import statement |

### Category Mapping

| Capture Context | SemanticCategory | Notes |
|----------------|------------------|-------|
| Definition node | DEFINITION | Declaring symbol |
| Import statement | IMPORT | Importing symbol |
| Export statement | EXPORT | Exporting symbol |
| Function call | REFERENCE | Using symbol |
| Variable usage | REFERENCE | Using symbol |
| Block/function/class | SCOPE | Scope boundary |

### Examples of Complete Mappings

```javascript
// Input: export async function processData(input) { ... }
{
  category: DEFINITION,
  entity: FUNCTION,
  node_location: { start: 0, end: 50 },
  symbol_name: 'processData',
  context: {
    exported_as: 'processData',
    export_type: 'named',
    is_async: true,
    visibility: 'public'
  }
}

// Input: await fetchUser()
{
  category: REFERENCE,
  entity: CALL,
  node_location: { start: 100, end: 117 },
  symbol_name: 'fetchUser',
  context: {
    is_awaited: true
  }
}
```

## Implementation Instructions for Sub-tasks

**ALL SUB-TASKS MUST**:
1. Read this complete mapping plan before starting
2. Follow the mappings exactly as specified above
3. NOT add any fields not listed in the plan
4. Remove the `modifiers` function from CaptureMapping entirely
5. Merge all modifier logic into the single `context` function
6. Ensure context is ALWAYS non-null (use {} if empty)
7. Reference specific rows from the mapping tables when implementing

## Sub-tasks

### 1. [task-epic-11.102.1.1] Update Language Config
- **File**: `packages/core/src/parse_and_query_code/language_configs/javascript.ts`
- **Actions**:
  - REMOVE `modifiers` function from all CaptureMapping entries
  - MERGE all modifier logic (is_async, visibility, etc.) into the `context` function
  - Update context to include all 14 unified fields
  - Remove unused SyntaxNode references from context
  - Map visibility: '#' prefix → 'private', default → 'public'
  - Move async/generator detection into context

### 2. [task-epic-11.102.1.2] Update Query File
- **File**: `packages/core/src/parse_and_query_code/queries/javascript.scm`
- **Actions**:
  - Minimal changes expected (queries mostly stay the same)
  - Remove any captures that were only used for the old modifiers function
  - Ensure async/generator keywords are captured for context
  - Ensure visibility markers (#) are captured for context

### 3. [task-epic-11.102.1.3] Update Tests
- **File**: `packages/core/src/parse_and_query_code/language_configs/javascript.test.ts`
- **Actions**:
  - Update test expectations to use unified context
  - Verify all modifier fields are now in context (is_async, visibility, etc.)
  - Ensure context is always non-null
  - Test all 14 possible context fields work correctly
  - Remove tests that verified modifiers vs context separation

## JavaScript-Specific Considerations

### Unified Context Population
```typescript
// OLD: Separate functions
{
  modifiers: (node) => ({ is_async: true, visibility: 'public' }),
  context: (node) => ({ exported_as: 'name' })
}

// NEW: Single context function
{
  context: (node) => ({
    is_async: true,
    visibility: 'public',
    exported_as: 'name'
  })
}
```

### Export/Import Types
- `export default` → export_type: 'default'
- `export { name }` → export_type: 'named'
- `export * from` → export_type: 'reexport'
- `import x from` → import_type: 'default'
- `import { x }` → import_type: 'named'
- `import * as ns` → import_type: 'namespace'

### Async/Generator Detection (in context)
- `async function` → is_async: true
- `function*` → is_generator: true
- Arrow functions → Check for async keyword
- `await` calls → is_awaited: true
- `for...of` loops → is_iterated: true

### Visibility Detection (in context)
- Default: 'public' (no keyword)
- Private: '#' prefix → 'private'
- Protected: Not supported in JS → N/A

## Expected Outcome
- JavaScript captures use unified context with 14 fields total
- NO separate modifiers function in CaptureMapping
- Context contains all information (4 import + 3 export + 5 definition + 2 relationship)
- All existing functionality preserved
- Tests pass with 100% coverage
- Context is always non-null

## Dependencies

- Parent task task-epic-11.102 must define final unified context structure

## Testing Checklist

- [ ] No modifiers function exists in language config
- [ ] All modifier fields moved to context function
- [ ] Context is always non-null (never undefined)
- [ ] All 14 context fields work when applicable
- [ ] Import/export resolution works
- [ ] Async/generator detection works (in context)
- [ ] Visibility mapping works (in context)
- [ ] No deprecated fields remain
