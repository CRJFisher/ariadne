# API Negotiation Strategy: detect_call_graph → Registry Integration

**Date**: 2025-10-10
**Focus**: Planning how to plan - the iterative negotiation process
**Parent Task**: task-epic-11.140

---

## Overview

This document defines the **5 core negotiation points** between `detect_call_graph`'s needs and registry APIs, along with the iterative strategy for resolving each one.

**Key Principle**: Start with simplest approach (no data structure changes), measure, escalate only when proven necessary.

---

## The 5 Negotiation Points

### NP1: Function ↔ Scope Linking
**Question**: Given FunctionDefinition, how do we find its body scope?

**Options**:
- **1A (Simple)**: Name + location fuzzy matching
- **1B (Escalate)**: Add `body_scope_id` to FunctionDefinition
- **1C (Escalate)**: Add `defining_symbol_id` to LexicalScope

**Decision Criteria**: If matching fails >5% of test cases → escalate

---

### NP2: Scope Containment
**Question**: Is scope A within scope B (without crossing functions)?

**Options**:
- **2A (Simple)**: Traverse parent chain on-demand
- **2B (Escalate)**: Pre-compute ancestry map
- **2C (Escalate)**: Add `depth` field to scopes

**Decision Criteria**: If >10k checks OR >1s total time → escalate

---

### NP3: Enclosing Function
**Question**: Given CallReference at scope S, what function is it inside?

**Options**:
- **3A (Simple)**: Traverse + match (combines NP1 + NP2)
- **3B (Escalate)**: Pre-compute scope→function map
- **3C (Escalate)**: Add `enclosing_function_id` to scopes

**Decision Criteria**: If profiling shows this is bottleneck → escalate

---

### NP4: Referenced Symbols
**Question**: What SymbolIds are referenced (for entry point detection)?

**Options**:
- **4A (Simple)**: Build set on-demand from ResolutionCache
- **4B (Escalate)**: Maintain incrementally
- **4C (Escalate)**: Separate reverse index

**Decision**: Use 4A (query is infrequent, O(n) acceptable)

---

### NP5: Function Filtering
**Question**: How to get only function/method/constructor definitions?

**Options**:
- **5A (Simple)**: Filter in client code
- **5B (Escalate)**: Add method to DefinitionRegistry
- **5C (Escalate)**: Separate FunctionRegistry

**Decision**: Use 5A (simple, flexible)

---

## Implementation Order

### Phase 1: Simplest Implementation (All "A" options)

**1.1 NP5** - Function filtering (trivial, establishes pattern)

**1.2 NP4** - Referenced symbols (straightforward)

**1.3 NP1A** - Function→scope matching (core challenge)
- Test cases: simple function, method, nested, anonymous
- **Expected issues**: Ambiguous matches, missing scopes
- **Decision point**: Success rate < 95% → escalate to NP1B

**1.4 NP2A** - Scope containment (enables next step)
- Add performance logging (# calls, time)
- **Decision point**: Too many checks or too slow → escalate to NP2B

**1.5 NP3A** - Enclosing function (combines NP1 + NP2)
- Validate with nested functions
- **Decision point**: Profiling shows bottleneck → escalate to NP3B

**Validation**: Build call graph for 2-function test case

---

## Negotiation Process

At each decision point:

1. **Observe** - What failed? What's slow?
2. **Measure** - Quantify (%, ms, count)
3. **Propose** - List 2-3 alternatives
4. **Analyze** - Pros/cons/trade-offs
5. **Decide** - Simplest that could work
6. **Implement** - Incrementally
7. **Validate** - Test thoroughly
8. **Document** - Record in task notes

---

## Escalation Triggers

| Negotiation Point | Escalation Trigger | Next Option |
|-------------------|-------------------|-------------|
| NP1 | Match success < 95% | Add body_scope_id to definitions |
| NP2 | >10k checks OR >1s | Pre-compute ancestry map |
| NP3 | Profiler shows bottleneck | Pre-compute scope→function map |
| NP4 | N/A (use 4A) | N/A |
| NP5 | N/A (use 5A) | N/A |

---

## Key Insights

1. **NP1 and NP2/3 are the real negotiation points** - These determine if we need semantic_index changes
2. **Measure before optimizing** - Don't assume performance problems
3. **Fail fast** - If simple approach doesn't work, escalate quickly with clear justification
4. **Document everything** - Each escalation needs data to support the decision

**The meta-level insight**: We're not just planning the implementation - we're planning the negotiation process itself, with clear decision criteria at each step.
