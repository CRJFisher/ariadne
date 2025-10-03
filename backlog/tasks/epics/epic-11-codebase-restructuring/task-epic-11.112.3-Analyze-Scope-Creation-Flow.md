# Task epic-11.112.3: Analyze Scope Creation Flow

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 1 analysis document

## Objective

Document the complete scope creation flow from `.scm` queries → `scope_processor` → definition builders. Understand why functions work correctly but classes don't.

## Files to Create

- `backlog/tasks/epics/epic-11-codebase-restructuring/scope-creation-flow-analysis.md`

## Implementation Steps

### 1. Analyze .scm Scope Patterns (45 min)

For each language, document scope patterns:

```bash
# JavaScript
grep "@scope" packages/core/src/index_single_file/query_code_tree/queries/javascript.scm

# TypeScript
grep "@scope" packages/core/src/index_single_file/query_code_tree/queries/typescript.scm

# Python
grep "@scope" packages/core/src/index_single_file/query_code_tree/queries/python.scm

# Rust
grep "@scope" packages/core/src/index_single_file/query_code_tree/queries/rust.scm
```

Document in analysis file:
```markdown
## .scm Scope Patterns

### JavaScript/TypeScript
- `(function_declaration) @scope.function` - ONE scope per function
- `(class_declaration) @scope.class` - ONE scope per class
- `(method_definition) @scope.method` - ONE scope per method
- `(statement_block) @scope.block` - ONE scope per block

**Key Finding:** No evidence of separate function "name" vs "body" scopes.

### [Repeat for Python, Rust]
```

### 2. Trace scope_processor Flow (30 min)

Read and document:
```typescript
// packages/core/src/index_single_file/scopes/scope_processor.ts

1. process_scopes(captures, file)
   - Creates LexicalScope objects from captures
   - One scope per capture
   - Builds parent-child relationships

2. create_processing_context(scopes, captures)
   - Creates ProcessingContext with get_scope_id()
   - get_scope_id() finds DEEPEST scope containing a location
```

Document the mechanism:
```markdown
## scope_processor Flow

1. Tree-sitter executes .scm queries
2. Returns captures: {name: "@scope.function", location: {...}, text: "myFunc"}
3. process_scopes() creates LexicalScope for each capture
4. LexicalScope.location = entire AST node span (including body)
5. create_processing_context() provides get_scope_id(location)
   - Finds deepest scope containing location
   - Uses cached depths for efficiency
```

### 3. Trace Definition Builder Flow (30 min)

For classes specifically:

```typescript
// In typescript_builder_config.ts
{
  name: "definition.class",
  handler: (capture, context, builder) => {
    builder.add_class({
      name: capture.text,
      location: capture.location,  // ← SPANS ENTIRE CLASS BODY
      scope_id: context.get_scope_id(capture.location),  // ← BUG HERE
      // ...
    });
  }
}
```

Document:
```markdown
## Definition Builder Flow (TypeScript Class Example)

1. .scm: `(class_declaration name: (type_identifier) @definition.class)`
2. Tree-sitter captures: {name: "@definition.class", location: lines 10-30}
3. Handler called with capture
4. capture.location spans ENTIRE class (lines 10-30)
   - Line 10: `class MyClass {`
   - Lines 15-20: `method() { ... }`  ← Creates method_scope
   - Line 30: `}`
5. context.get_scope_id(lines 10-30)
   - Finds deepest scope in that range
   - Returns method_scope ❌ (should be parent scope)
6. Class definition registered with wrong scope_id
```

### 4. Compare Function vs Class (30 min)

Why do functions work?

Test hypothesis:
```typescript
// In typescript_builder_config.ts, find function handler
// Compare capture.location for functions vs classes
```

Document findings:
```markdown
## Why Functions Work But Classes Don't

### Hypothesis 1: Function captures use different location
- Function capture might only include function header?
- Need to verify with actual capture data

### Hypothesis 2: Functions don't contain nested scopes at capture time
- Function body scopes created after function definition?
- Need to verify scope creation order

### Hypothesis 3: [After investigation]
[Document actual reason found]
```

### 5. Map All get_scope_id() Callsites (30 min)

```bash
grep -rn "get_scope_id" packages/core/src/index_single_file/query_code_tree/language_configs/
```

Document each callsite:
```markdown
## get_scope_id() Usage Analysis

### JavaScript (javascript_builder_config.ts)
- Line X: class definitions
- Line Y: function definitions
- Line Z: variable definitions

### TypeScript (typescript_builder_config.ts)
- Line X: class definitions
- Line Y: interface definitions
- Line Z: enum definitions
- [etc]

### Pattern
All definition types use: `scope_id: context.get_scope_id(capture.location)`
```

### 6. Determine .scm Changes Needed (30 min)

Per @changes-notes.md#95-102 guidelines:

```markdown
## .scm File Changes Assessment

### Question: Do we need to modify .scm files?

#### Option A: No .scm changes needed
- Fix in get_scope_id() usage (use start position only)
- Pro: No query changes, less risky
- Con: Relies on implementation detail

#### Option B: Modify .scm queries
- Capture parent scope explicitly
- Pro: More accurate at source
- Con: Complex, affects all languages

### Recommendation: Option A
Because:
1. .scm queries are correct (one scope per construct)
2. Issue is in get_scope_id() usage (full span vs start position)
3. Simpler fix with less risk
```

### 7. Create Flow Diagrams (30 min)

Add visual diagrams to document:

```markdown
## Visual Flow Diagram

### Current (Buggy) Flow
```
.scm query → capture (location: full class span)
    ↓
handler: context.get_scope_id(full span)
    ↓
get_scope_id finds deepest scope in span = method_scope ❌
    ↓
class.scope_id = method_scope (WRONG)
```

### Fixed Flow
```
.scm query → capture (location: full class span)
    ↓
handler: context.get_defining_scope_id(full span)
    ↓
get_defining_scope_id uses START position only
    ↓
finds scope at definition point = parent_scope ✓
    ↓
class.scope_id = parent_scope (CORRECT)
```
```

## Success Criteria

- ✅ Complete documentation of scope creation flow
- ✅ Understanding of why functions work but classes don't
- ✅ All get_scope_id() callsites mapped
- ✅ .scm change assessment complete
- ✅ Visual diagrams created
- ✅ Ready to design fix in task-epic-11.112.4

## Outputs

- `scope-creation-flow-analysis.md` with complete documentation

## Next Task

**task-epic-11.112.4** - Design fix strategy
