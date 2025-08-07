---
id: task-epic-11.4
title: Combined Structure Proposal Document
status: To Do
assignee: []
created_date: "2025-08-07"
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

- [ ] Complete structure proposal document created
- [ ] Every current file mapped to new location
- [ ] Every function assigned to appropriate module
- [ ] All naming conventions standardized
- [ ] Migration complexity assessed for each component
- [ ] Dependencies and migration order defined
- [ ] Test migration strategy detailed
- [ ] Documentation structure finalized

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
