---
id: TASK-190.38
title: "Resolve explicitly-invoked dunder methods with non-protocol arity"
status: To Do
assignee: []
labels:
  - call-resolution
  - python
  - bug
  - true-positive
parent_task_id: TASK-190
priority: medium
created_date: "2026-07-15 00:00"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A Python method named like a dunder but carrying a **non-protocol signature** is
invoked **explicitly**, not through the interpreter protocol — and Ariadne fails
to resolve the explicit call, marking the definition unreachable. This is a
genuine resolution true positive (an in-source call edge Ariadne should bind),
not a permanent limitation.

Surfaced by the `py-dunder-protocol` drift investigation (PyTorch dynamo):

```python
class VariableTracker:
    def __iter__(self, tx: "InstructionTranslatorBase") -> VariableTracker: ...
```

The Python iteration protocol invokes `type(obj).__iter__(obj)` with no extra
argument, so an `__iter__(self, tx)` can never be dispatched implicitly — the
symbolic tracer calls it explicitly as `value.__iter__(tx)`. The `__iter__`
name makes it _look_ like the implicit-protocol permanent limitation the
`py-dunder-protocol` classifier catalogs, but the extra required parameter is
the tell that it is an ordinary explicit method call the resolver missed.

The `py-dunder-protocol` classifier is name-only, so it would already suppress
this true positive if the entry were indexed as `kind: "method"`; it returned
`false` here only because of a `kind` guard. Distinguishing a protocol-signature
dunder (`__iter__(self)`) from an explicitly-invoked lookalike
(`__iter__(self, tx)`) needs signature/arity inspection — which belongs in the
call resolver, not bolted onto the classifier.

### Scope

- Investigate why `value.__iter__(tx)` explicit call sites are not resolved to a
  `def __iter__(self, tx)` definition. Determine whether the caller is indexed
  (a resolver gap) or genuinely external (then it is a different limitation).
- If a resolver gap: bind the explicit dunder-named call the same as any other
  explicit method call.
- Guard the `py-dunder-protocol` classifier so a dunder with non-protocol arity
  is not suppressible — a protocol dunder takes exactly `self` (plus the
  protocol's fixed args); an extra required parameter means explicit invocation.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] An explicit `obj.__iter__(arg)` call to a `def __iter__(self, arg)` in
      indexed code resolves to the definition (the method is reachable).
- [ ] A dunder method whose signature cannot match its implicit protocol arity
      is not suppressed by `py-dunder-protocol`.
- [ ] Test coverage for both the protocol-arity (suppress) and
      non-protocol-arity (resolve/report) cases.

<!-- AC:END -->

## Cross-references

- Classifier that surfaced it: `packages/core/src/classify_entry_points/builtins/check_py-dunder-protocol.ts`
- Call resolution: `packages/core/src/resolve_references/call_resolution/`
