# Task 11.100.0: Update Documentation and Architecture for Tree-sitter Query System

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Overview

**Critical Pre-requisite**: Update all documentation and architectural guidelines BEFORE beginning the massive refactoring. This ensures the transformation follows proper patterns and meets all requirements for the new query-based architecture.

## Scope

This task must be completed BEFORE any refactoring subtasks (11.100.1-19) begin.

## Documentation Updates Required

### 1. Architecture Documentation

- [ ] **rules/folder-structure-migration.md**

  - Update to reflect query-based architecture
  - Document .scm file placement patterns
  - Update feature organization for query modules
  - Add guidelines for language-specific query files

- [ ] **rules/refactoring.md**

  - Add patterns for Tree-sitter query integration
  - Document query file management
  - Update refactoring approach for query-based modules

- [ ] **rules/language-support.md**
  - Update for query-based language handling
  - Document .scm file requirements per language
  - Update LanguageConfiguration patterns

### 2. CLAUDE.md Backup and Update

- [ ] **Backup Current CLAUDE.md**

  ```bash
  cp CLAUDE.md CLAUDE.md.backup.pre-treesitter-transformation
  ```

- [ ] **Update CLAUDE.md for Transformation**
  - Add Tree-sitter query development guidelines
  - Document .scm file creation patterns
  - Add testing requirements for query modules
  - Include type safety requirements
  - Document the new 19-module architecture
  - Add performance benchmarking requirements

### 3. Project Documentation

- [ ] **README updates** (if applicable)

  - Update architecture overview
  - Document query-based approach
  - Update performance characteristics

- [ ] **API Documentation**
  - Update for new query-based interfaces
  - Document breaking changes from transformation
  - Add migration guide for consumers

### 4. Development Guidelines

- [ ] **Query Development Standards**

  - Create .scm file naming conventions
  - Document query pattern standards
  - Add language-specific query requirements
  - Performance optimization guidelines

- [ ] **Testing Standards for Query Modules**

  - 100% test coverage requirements
  - Query validation testing patterns
  - Performance regression testing
  - Cross-language consistency testing

- [ ] **Type Safety Requirements**
  - Type definitions for query results
  - Interface consistency across modules
  - Generic type handling patterns

## New Architecture Patterns

### Module Structure

```
src/[category]/[feature]/
├── index.ts              # Main export
├── [feature].ts          # Core logic with queries
├── queries/
│   ├── javascript.scm    # JS query patterns
│   ├── typescript.scm    # TS query patterns
│   ├── python.scm        # Python query patterns
│   └── rust.scm          # Rust query patterns
├── [feature].test.ts     # Comprehensive tests
└── README.md             # Module documentation
```

### Special Case: scope_tree

- Must move existing files from `scope_queries/` to `scope_analysis/scope_tree/queries/`
- Preserve existing sophisticated query patterns
- Update module to use relocated files

## Implementation Steps

### Phase 1: Documentation Audit

1. [ ] Review all current architectural documents
2. [ ] Identify gaps for query-based architecture
3. [ ] Document required changes

### Phase 2: CLAUDE.md Preparation

1. [ ] Create backup of current CLAUDE.md
2. [ ] Draft updated CLAUDE.md with transformation requirements
3. [ ] Include all testing, typing, and quality requirements

### Phase 3: Architecture Updates

1. [ ] Update folder-structure-migration.md
2. [ ] Update refactoring.md patterns
3. [ ] Update language-support.md for queries
4. [ ] Create query development guidelines

### Phase 4: Validation

1. [ ] Review all updated docs for consistency
2. [ ] Ensure coverage of all 19 modules
3. [ ] Validate against transformation requirements

## Success Criteria

- [ ] All architectural documents updated
- [ ] CLAUDE.md backed up and updated
- [ ] Clear guidelines for .scm file structure
- [ ] Testing requirements documented
- [ ] Type safety requirements specified
- [ ] Ready for type review task (11.100.0.5)

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
