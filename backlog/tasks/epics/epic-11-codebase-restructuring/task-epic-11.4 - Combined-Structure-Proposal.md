---
id: task-epic-11.4
title: Combined Structure Proposal Document
status: Done
assignee: []
created_date: "2025-08-07"
completed_date: "2025-08-07"
labels:
  - architecture
  - planning
  - design
dependencies:
  - task-epic-11.1
  - task-epic-11.2
  - task-epic-11.3
parent_task_id: task-epic-11-codebase-restructuring
---

## Description

Synthesize the findings from the Information Architecture Plan, Functionality Tree Analysis, and Code Style Audit into a comprehensive proposal for the new codebase structure. This document will define the exact target architecture, including folder hierarchy, file organization, function boundaries, and migration mappings.

## Motivation

With three foundational analyses complete, we need to:

- Combine insights into actionable architecture
- Resolve conflicts between ideal and practical
- Define precise migration targets
- Create the blueprint for transformation

This proposal will be the definitive guide for the entire migration effort.

## Acceptance Criteria

- [x] Complete structure proposal document created
- [x] Every current file mapped to new location
- [x] Every function assigned to appropriate module
- [x] All naming conventions standardized
- [x] Migration complexity assessed for each component
- [x] Dependencies and migration order defined
- [x] Test migration strategy detailed
- [x] Documentation structure finalized

## Deliverables

### Primary Deliverable: Structure Proposal Document

Location: `backlog/tasks/epics/epic-11-codebase-restructuring/NEW_STRUCTURE_PROPOSAL.md`

Structure:

```markdown
# Ariadne New Structure Proposal

## Executive Summary

- Current state: X files in Y directories
- Target state: A files in B directories
- Migration scope: C components
- Estimated effort: D weeks

## Target Architecture

### Directory Structure

src/
├── call_graph/
│ ├── function_calls/
│ │ ├── function_calls.ts
│ │ ├── function_calls.test.ts
│ │ ├── function_calls.javascript.ts
│ │ └── function_calls.javascript.test.ts
│ └── method_resolution/
│ └── [...]
├── import_resolution/
│ └── [...]
└── [...]

## Migration Mappings

### File Relocations

| Current Location                | New Location                                    | Refactoring Required |
| ------------------------------- | ----------------------------------------------- | -------------------- |
| src/call_graph/call_analysis.ts | src/call_graph/function_calls/function_calls.ts | Split into 3 files   |

### Function Redistributions

| Function      | Current File         | New File             | Changes                  |
| ------------- | -------------------- | -------------------- | ------------------------ |
| analyzeCall() | call_analysis.ts:234 | function_calls.ts:45 | Convert to pure function |

## Implementation Order

### Phase 1: Foundation (Week 1)

1. Create new directory structure
2. Set up test contracts
3. Implement validation tooling

### Phase 2: Core Features (Week 2-4)

[Detailed migration order based on dependencies]

[...]
```

### Secondary Deliverables

1. **Migration Checklist** (`backlog/tasks/epics/epic-11-codebase-restructuring/MIGRATION_CHECKLIST.md`)

   - Step-by-step migration tasks
   - Validation points
   - Rollback procedures

2. **Conflict Resolution Document** (`backlog/tasks/epics/epic-11-codebase-restructuring/STRUCTURE_CONFLICTS.md`)

   - Conflicts between analyses
   - Trade-off decisions
   - Rationale for choices

3. **Visual Architecture Diagrams**
   - Current vs target structure
   - Dependency graphs
   - Migration flow charts

## Synthesis Methodology

### Phase 1: Alignment Analysis

- Compare functionality tree with architecture plan
- Map code style violations to refactoring needs
- Identify structural impediments to compliance

### Phase 2: Conflict Resolution

- Ideal architecture vs practical constraints
- Performance vs cleanliness trade-offs
- Migration effort vs long-term benefit

### Phase 3: Target Definition

- Final directory structure
- Module boundaries
- Interface definitions
- Naming conventions

### Phase 4: Migration Planning

- Dependency order
- Parallel work streams
- Risk mitigation strategies
- Validation checkpoints

## Key Design Decisions

### Universal vs Language-Specific

Criteria for universal features:

- Conceptually similar across 3+ languages
- Share >60% implementation logic
- Benefit from unified interface

Criteria for language-specific:

- Unique to 1-2 languages
- Fundamentally different implementations
- No meaningful abstraction possible

### Module Boundaries

Principles:

- Single responsibility per module
- Clear input/output contracts
- Minimal cross-module dependencies
- Test locality (tests near code)

### File Organization

Rules:

- Max 500 lines per file (target 200-300)
- One primary export per file
- Related helpers co-located
- Types defined with implementation

### Function Design

Standards:

- Pure functions by default
- Explicit side effects
- Single purpose
- Composable primitives

## Migration Complexity Assessment

### Low Complexity (1-2 hours each)

- Simple file moves
- Naming convention updates
- Dead code removal

### Medium Complexity (4-8 hours each)

- File splits
- Function extractions
- Module reorganization

### High Complexity (1-3 days each)

- Stateful to functional conversion
- Cross-cutting concern extraction
- Architecture pattern changes

### Critical Path Items

- Core abstractions must migrate first
- Test infrastructure before features
- Documentation with implementation

## Risk Analysis

### Technical Risks

- Circular dependency introduction
- Performance regression
- Test coverage gaps

### Process Risks

- Merge conflict explosion
- Parallel development disruption
- Documentation lag

### Mitigation Strategies

- Automated dependency checking
- Performance benchmarking
- Test coverage enforcement
- Feature flags for gradual rollout

## Success Metrics

- Zero circular dependencies
- 100% test contract compliance
- <32KB file size limit met
- 90%+ functional code style
- Complete documentation coverage

## Estimated Timeline

- Synthesis and analysis: 1 day
- Conflict resolution: 0.5 days
- Proposal drafting: 1 day
- Review and refinement: 0.5 days

**Total: 3 days**

## Implementation Notes

### Priority Principles

1. **Correctness over convenience** - Get structure right first
2. **Explicit over implicit** - Clear boundaries and contracts
3. **Testability over brevity** - Optimize for testing
4. **Consistency over local optimization** - Uniform patterns

### Non-Goals

- Backwards compatibility (not required)
- Incremental migration (do it right once)
- Legacy pattern preservation (clean slate)

### Open Questions

To be resolved during synthesis:

- Monorepo vs multi-package structure?
- Shared utilities location?
- Cross-language test fixtures?
- Documentation generation approach?

## Implementation Notes

### Approach Taken

Synthesized findings from three comprehensive analyses:
1. **Information Architecture Plan** - Ideal structure patterns
2. **Functionality Tree Analysis** - Current state mapping (487 functions)
3. **Code Style Audit** - 847 violations to address

Created a systematic proposal that resolves conflicts between ideal and practical constraints while providing a clear migration path.

### Key Architectural Decisions

#### 1. Functional Core with Compatibility Wrappers
**Decision**: Use adapter pattern to migrate from stateful to functional
**Rationale**: Allows incremental migration without breaking consumers
**Impact**: All 23 stateful classes will have temporary adapters

#### 2. Feature-Based Organization
**Decision**: Organize by feature (call_graph/, imports/) not by type
**Rationale**: Better discoverability and cohesion
**Structure**: 40+ directories replacing current 12

#### 3. Strict Size Limits
**Decision**: Hard limit 30KB, target 10KB per file
**Rationale**: Tree-sitter parsing limit at 32KB
**Impact**: 8 files need immediate splitting

#### 4. Test Contracts Pattern
**Decision**: Every universal feature has test contract interface
**Rationale**: Enforces language parity
**Implementation**: TypeScript interfaces with required test cases

### Migration Strategy Highlights

#### Phased Approach (10 weeks)
- **Phase 0**: Setup and prerequisites
- **Phase 1**: Foundation (no dependencies)
- **Phase 2**: Parsing layer
- **Phase 3**: Scope analysis (critical)
- **Phase 4**: Import/export system
- **Phase 5**: Type system
- **Phase 6**: Call graph core
- **Phase 7**: Project refactoring
- **Phase 8**: Cleanup

#### Critical Refactorings

1. **scope_resolution.ts** (22.3KB)
   - Split 457-line function into 6 functions
   - Convert ScopeGraph class to immutable
   - Create 8 new files

2. **reference_resolution.ts** (28.9KB)
   - Split into 4 strategy-based modules
   - Each ~7KB focused on one resolution type

3. **Project class** (stateful)
   - Create immutable state core
   - Pure operation functions
   - Compatibility wrapper for migration

### Deliverables Created

1. **NEW_STRUCTURE_PROPOSAL.md** (Primary)
   - Complete target directory structure
   - 200+ files in 40+ directories
   - Detailed migration mappings
   - 8-phase implementation plan

2. **STRUCTURE_CONFLICTS.md**
   - 5 major conflict categories identified
   - Resolution strategies for each
   - Trade-off decisions documented
   - Risk mitigation approaches

3. **MIGRATION_CHECKLIST.md**
   - 300+ checklist items
   - Phase-by-phase tasks
   - Validation gates
   - Rollback procedures

### Complexity Assessment

**Total Effort**: 400 hours (10 weeks)
- Low complexity: 67.5 hours (45 tasks)
- Medium complexity: 150 hours (25 tasks)
- High complexity: 192 hours (12 tasks)

**Critical Path**:
1. Scope resolution (everything depends on it)
2. Import resolution (needed for references)
3. Type tracking (needed for call graph)
4. Call graph (needed for project)
5. Project refactor (public API)

### Risk Analysis

**Highest Risks**:
1. **Performance regression** - Mitigated by benchmarking
2. **API breaking changes** - Mitigated by compatibility layer
3. **Circular dependencies** - Mitigated by dependency analysis

**Process Risks**:
1. **Scope creep** - Mitigated by strict phase boundaries
2. **Merge conflicts** - Mitigated by feature branches

### Success Metrics Defined

**Quantitative**:
- All files < 30KB (hard requirement)
- 90% files < 10KB (target)
- Zero stateful classes
- Functions < 50 lines
- < 10% performance regression

**Qualitative**:
- Clear module boundaries
- Consistent patterns
- Discoverable structure
- Maintainable tests

### Key Insights

1. **Fundamental Paradigm Shift Required**
   - Current: Object-oriented, stateful
   - Target: Functional, immutable
   - Strategy: Gradual migration with adapters

2. **File Size Crisis**
   - 5 files approaching parser limits
   - Must split before any other work
   - Logical boundaries, not arbitrary splits

3. **Test Structure Revolution**
   - Current: Monolithic test files
   - Target: Contract-based, language-specific
   - Benefit: Enforced language parity

4. **Dependency Untangling**
   - 3 circular dependencies identified
   - Clear levels defined (0-7)
   - Migration order follows dependency graph

### Next Steps

1. Review and approve proposal
2. Create migration branch
3. Set up parallel structure
4. Begin Phase 0 setup
5. Start foundation migration

The proposal provides a comprehensive blueprint for transforming Ariadne from its current mixed-paradigm state to a clean, functional architecture with clear boundaries and maintainable structure.
