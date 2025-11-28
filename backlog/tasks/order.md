# Task Execution Order for Eliminating False Positive Entry Points

This document defines the order in which tasks must be executed to eliminate all false positive entry points when running ariadne on itself.

## Overview

Based on analysis of `top-level-nodes-analysis/results/false_positive_groups.json`, there are **15 distinct false positive groups** containing **100+ false positive entries**. These are addressed by **8 tasks** (1 existing + 7 new).

## Task Dependencies

```
┌─────────────────────────────────────────────────────────┐
│  Task 11.166    Remove dead code (no deps)              │
│  21 entries                                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Task 11.165    Filter non-callable (no deps)           │
│  7 entries                                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Task 11.161    Named handler extraction                 │
│  21 entries     (anonymous function calls)               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Task 11.162    Track all function body calls            │
│  10 entries     (loops, helpers, nested, args)           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Task 11.163    Track this/super method calls           │
│  3 entries      (depends on 11.162 call extraction)      │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Task 11.164    Track property/object literal method    │
│  19 entries     (depends on 11.163 this resolution)      │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Task 11.167    Resolve polymorphic factory pattern     │
│  5 entries      (depends on 11.164 type resolution)     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Task 11.168    Handle external/test callers             │
│  21 entries     (analysis scope, not bugs)               │
└─────────────────────────────────────────────────────────┘
```

## Execution Order

### Phase 1: Independent Cleanup Tasks (can run in parallel)

These tasks have no dependencies and can be executed in any order or in parallel:

| Order | Task   | Title                                                       | Entries | Priority |
| ----- | ------ | ----------------------------------------------------------- | ------- | -------- |
| 1a    | 11.166 | Remove Dead Exported Code                                   | 21      | Medium   |
| 1b    | 11.165 | Filter Non-Callable Definitions from Entry Points           | 7       | Medium   |
| 1c    | 11.161 | File Naming Conventions & Codebase Cleanup (Named Handlers) | 21      | High     |

### Phase 2: Core Call Graph Fixes (sequential)

These tasks build on each other and must be executed in order:

| Order | Task   | Title                                           | Entries | Priority    |
| ----- | ------ | ----------------------------------------------- | ------- | ----------- |
| 2     | 11.162 | Track All Call Graph Edges from Function Bodies | 10      | High        |
| 3     | 11.163 | Track this.method() and super.method() Calls    | 3       | Medium-High |
| 4     | 11.164 | Track Object Literal and Property Method Calls  | 19      | High        |
| 5     | 11.167 | Resolve Polymorphic Factory Pattern Calls       | 5       | Medium      |

### Phase 3: Analysis Scope Improvements (optional)

This task addresses analysis scope rather than call graph bugs:

| Order | Task   | Title                                         | Entries | Priority |
| ----- | ------ | --------------------------------------------- | ------- | -------- |
| 6     | 11.168 | Handle External Callers and Test-Only Methods | 21      | Low      |

## Entry Point Impact Summary

| Task   | Groups Addressed                                                                                  | Total Entries |
| ------ | ------------------------------------------------------------------------------------------------- | ------------- |
| 11.161 | anonymous-function-body-calls-not-tracked                                                         | 21            |
| 11.162 | internal-helper-function, for-loop-body, recursive-method, nested-function, array-method-argument | 10            |
| 11.163 | recursive-method, super-method, class-internal-method                                             | 3             |
| 11.164 | object-literal-internal-method, class-property-method                                             | 19            |
| 11.165 | typescript-interface-method-signatures                                                            | 7             |
| 11.166 | exported-unused-dead-code                                                                         | 21            |
| 11.167 | factory-pattern-polymorphic-calls                                                                 | 5             |
| 11.168 | external-caller-outside-analysis-scope, test-only-public-methods                                  | 21            |

**Note**: Some entries appear in multiple groups, so totals may overlap.

## Quick Start

To begin eliminating false positives:

1. **Start with 11.166** - Dead code removal is simple and immediately reduces entry points
2. **Then 11.161** - Named handler extraction is well-defined and high-impact
3. **Then 11.162** - Core call extraction is foundational for remaining fixes
4. **Continue sequentially** through remaining tasks

## Validation

After completing all tasks, run the false positive detection again:

```bash
npx tsx top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts
npx tsx top-level-nodes-analysis/triage_false_positive_entrypoints.ts
```

Expected result: Zero false positive groups (or only intentional entry points like main functions).
