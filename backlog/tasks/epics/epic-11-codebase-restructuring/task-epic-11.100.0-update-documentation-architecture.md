# Task 11.100.0: Update Documentation and Architecture for Tree-sitter Query System

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Overview

**Critical Pre-requisite**: Update all documentation and architectural guidelines BEFORE beginning the massive refactoring. This ensures the transformation follows proper patterns and meets all requirements for the new query-based architecture.

It is *essential* that the documentation is 'timeless' i.e. it shouldn't make reference to the change process / new architecture / old way of doing thing in any way. The documentation is for how to build things going forward, not as a record of what changes have been made.

## Scope

This task must be completed BEFORE any refactoring subtasks (11.100.1-19) begin.

## Documentation Updates Required

### 1. Architecture Documentation

- [x] **rules/folder-structure-migration.md**

  - Update to reflect query-based architecture
  - Document .scm file placement patterns
  - Update feature organization for query modules
  - Add guidelines for language-specific query files

- [x] **docs/Architecture.md**

  - This needs to be completely rewritten to reflect the new architecture. Delete it and start from scratch.

- [x] **rules/language-support.md**
  - Update for query-based language handling
  - Document .scm file requirements per language
  - Update LanguageConfiguration patterns

### 2. CLAUDE.md Backup and Update

- [x] **Backup Current CLAUDE.md**

  ```bash
  cp CLAUDE.md CLAUDE.md.backup.pre-treesitter-transformation
  ```

- [x] **Update CLAUDE.md for Transformation**
  - Add Tree-sitter query development guidelines
  - Document .scm file creation patterns
  - From the old CLAUDE.md keep:
    - a summary of the code-style guidelines as in rules/coding.md  e.g. pythonic naming conventions, etc.
    - a short description of the backlog workflow as in rules/backlog.md

## New Architecture Patterns

### Module Structure

```text
src/[category]/[feature]/
├── index.ts              # Main export
├── [feature].ts          # Core logic with queries
├── queries/
│   ├── javascript.scm    # JS query patterns
│   ├── typescript.scm    # TS query patterns
│   ├── python.scm        # Python query patterns
│   └── rust.scm          # Rust query patterns
└── [feature].test.ts     # Comprehensive tests
```

### Special Case: scope_tree

- Must move existing files from `scope_queries/` to `scope_analysis/scope_tree/queries/`
- Preserve existing sophisticated query patterns
- Update module to use relocated files

## Implementation Steps

### Phase 1: Documentation Audit

1. [x] Review all current architectural documents
2. [x] Identify gaps for query-based architecture
3. [x] Document required changes

### Phase 2: CLAUDE.md Preparation

1. [x] Create backup of current CLAUDE.md
2. [x] Draft updated CLAUDE.md with transformation requirements
3. [x] Include all testing, typing, and quality requirements

### Phase 3: Architecture Updates

1. [x] Update folder-structure-migration.md
2. [x] Update refactoring.md patterns
3. [x] Update language-support.md for queries
4. [x] Create query development guidelines

### Phase 4: Validation

1. [x] Review all updated docs for consistency
2. [x] Ensure coverage of all 19 modules
3. [x] Validate against transformation requirements

## Success Criteria

- [x] All architectural documents updated
- [x] CLAUDE.md backed up and updated
- [x] Clear guidelines for .scm file structure
- [x] Testing requirements documented
- [x] Type safety requirements specified
- [x] Ready for type review task (11.100.0.5)

## Deliverables

1. **Updated Documentation Files**

   - rules/folder-structure-migration.md
   - rules/refactoring.md
   - rules/language-support.md
   - Updated CLAUDE.md

2. **New Guidelines**

   - Query development standards
   - .scm file conventions
   - Testing patterns for query modules

3. **Architecture Validation**
   - Consistency across all docs
   - Coverage of all transformation aspects
   - Clear requirements for refactoring tasks

## Dependencies

- Must complete BEFORE 11.100.0.5 (type review)
- Must complete BEFORE any refactoring tasks (11.100.1-19)
- No external dependencies

## Timeline

- Target completion: 1-2 days
- Critical path item - blocks all refactoring work

## Notes

- This is foundational work that will guide all subsequent refactoring
- Quality here determines success of entire transformation
- Must be thorough to avoid rework during refactoring phase
- CLAUDE.md backup ensures we can restore if needed

## Implementation Notes

### Completed: 2025-09-11

All documentation has been successfully updated to reflect the tree-sitter query-based architecture:

1. **CLAUDE.md Backup**: Created backup at `CLAUDE.md.backup.pre-treesitter-transformation`

2. **rules/folder-structure-migration.md**: 
   - Completely rewritten for query-based module structure
   - Defined standard `queries/` directory pattern
   - Added query file examples and naming conventions
   - Removed all references to old configuration-driven pattern

3. **rules/language-support.md**:
   - Updated to focus on tree-sitter query patterns
   - Added comprehensive query examples for each language
   - Included query development process and best practices
   - Defined language parity requirements

4. **docs/Architecture.md**:
   - Completely rewritten from scratch
   - Focused on query-driven processing pipeline
   - Documented query system architecture
   - Added performance and security considerations

5. **CLAUDE.md**:
   - Added comprehensive tree-sitter query guidelines
   - Preserved essential code style and backlog workflow summaries
   - Included query development process and best practices
   - Updated module organization to reflect query structure

### Key Architectural Decisions

- All AST analysis now uses declarative tree-sitter queries
- Query files (.scm) are the primary mechanism for language-specific logic
- Module structure standardized around `queries/` directories
- Focus on query performance and caching for efficiency

### Validation Completed

- All documents are internally consistent
- No references to old patterns or migration process
- Documentation is "timeless" - describes the system as it should be
- Fixed all markdown linting issues for clean formatting

### Ready for Next Phase

Documentation is now ready to guide the refactoring work in tasks 11.100.1-19. The query-based architecture is clearly defined and all guidelines are in place.
