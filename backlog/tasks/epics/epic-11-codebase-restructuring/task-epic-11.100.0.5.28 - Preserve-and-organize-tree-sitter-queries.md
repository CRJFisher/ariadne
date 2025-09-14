# Task 11.100.0.5.28: Preserve and Organize Tree-sitter Queries

## Status
Status: Not Started
Priority: High
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary
Identify, preserve, and organize all existing tree-sitter query files (.scm) that will form the basis of the new query-based extraction system. Create a standard directory structure for queries.

## Current Query Files to Preserve

### Existing Queries
1. **scope_queries/** - Already has language-specific queries
   - `javascript.scm`
   - `typescript.scm`
   - `python.scm`
   - `rust.scm`

2. **Test Fixtures** (may contain useful patterns)
   - `type_analysis/generic_resolution/fixtures/*.test.scm`

## New Query Structure to Create

```
packages/core/src/queries/
├── functions/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
├── classes/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
├── imports/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
├── exports/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
├── calls/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
├── types/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
└── scopes/
    ├── javascript.scm
    ├── typescript.scm
    ├── python.scm
    └── rust.scm
```

## Implementation Steps

1. Create the new query directory structure
2. Move existing scope_queries to queries/scopes
3. Create placeholder .scm files for each category/language
4. Add README.md documenting query pattern conventions
5. Create a query loader utility that modules can use

## Query Loader Utility

```typescript
// queries/query_loader.ts
export function load_query(category: string, language: Language): string {
  const path = `./queries/${category}/${language}.scm`;
  // Load and return query string
}

export function execute_query(
  tree: Parser.Tree,
  query_string: string
): QueryMatch[] {
  // Execute tree-sitter query and return matches
}
```

## Success Criteria
- All existing queries are preserved in new structure
- Placeholder files exist for all categories/languages
- Query loader utility is functional
- Documentation explains query pattern conventions

## Dependencies
- Task 27: Must stub modules before reorganizing queries

## Follow-up Tasks
- Task 29: Implement query-based extractors for each category
- Task 30: Migrate existing manual patterns to queries