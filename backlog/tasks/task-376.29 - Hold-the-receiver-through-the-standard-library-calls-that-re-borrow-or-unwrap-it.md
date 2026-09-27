---
id: TASK-376.29
title: >-
  Hold the receiver through the standard-library calls that re-borrow or unwrap
  it
status: Done
assignee: []
created_date: '2026-09-27 18:55'
updated_date: '2026-09-27 21:37'
labels:
  - receiver_type_inference
dependencies:
  - TASK-376.25
parent_task_id: TASK-376
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

Rust code that holds `self` through a pinned or manually-dropped receiver first re-borrows or wraps it through the standard library:

- `let me = mem::ManuallyDrop::new(self)`
- `let this = Pin::into_inner(self)`, `Pin::get_mut(self)` and `Pin::into_inner_unchecked(self)`
- `let this = self.get_mut()` or `unsafe { self.get_unchecked_mut() }`, inside a method taking `self: Pin<&mut Self>`

Each hands back the receiver itself, or a transparent wrapper around it. The binding holds what `self` holds, so `this.m()` is a call on the enclosing type.

The value channel cannot see that. `std` is outside every corpus, so the callee resolves to nothing, and `initializer_sources.rust.ts` records no source for a `::` path call and does not look inside an `unsafe` block. The binding holds nothing, and every call through it ends `receiver_type_unknown`.

TASK-376.25 measured these as tokio's only five lost edges. Across tokio's sources they cover about 40 bindings, and rustc has about 12.

## Work plan

1. Make the Rust initialiser reader see through what a binding's value is written inside: an `unsafe { … }` block whose value is one expression, and the fixed set of `std` calls that return their own argument. The path calls take the argument: `ManuallyDrop::new`, `Pin::into_inner`, `Pin::get_mut`, `Pin::get_unchecked_mut` and `Pin::into_inner_unchecked`, bare or through a `std`/`core`/`mem`/`pin` path. The method calls `get_mut()` and `get_unchecked_mut()` on a bare `self` apply only in a method whose `self` is declared `Pin<…>`, where Rust's method lookup reaches `Pin`'s own method first.
2. Record `name_source` (and the call and collection sources) through that one reader, so `let this = Pin::into_inner(self)` indexes as `let this = self`, which the value channel already answers.
3. Measure on tokio and rustc against TASK-376.25's candidate row.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Rust `let` initialised through `unsafe { … }`, `ManuallyDrop::new(x)`, or a `Pin` unwrapping path call records the sources of the expression inside.
- [x] #2 `self.get_mut()` and `self.get_unchecked_mut()` read as `self` only in a method whose `self` is declared `Pin<…>`. A `self.inner.get_mut()`, or the same call on a `&mut self` receiver, records the call as it did before.
- [x] #3 `Project`-tier integration tests cover `ManuallyDrop::new(self)`, `Pin::into_inner(self)`, `unsafe { self.get_unchecked_mut() }` under a `Pin` receiver, and the `&mut self` negative.
- [x] #4 Per-reason recovery is measured on tokio and rustc against TASK-376.25's candidate row.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What the capability surface gained

A Rust binding that holds the receiver through the standard library is typed as the receiver: `let me = mem::ManuallyDrop::new(self)`, `let this = Pin::into_inner(self)` (and `get_mut`, `get_unchecked_mut`, `into_inner_unchecked`, bare or through `std`/`core`/`mem`/`pin`), and `let me = unsafe { self.get_unchecked_mut() }` or `self.get_mut()` in a method whose receiver is declared `self: Pin<…>`. On a `&mut self` receiver the same `self.get_mut()` is the pointee's own method and is left as it was, as is `self.inner.get_mut()`.

## Mechanism

`initializer_sources.rust.ts` reads every written value through `held_expression` before any fact is taken from it: an `unsafe` block ending in one expression, `RETURNS_ITS_ARGUMENT` path calls, and the two `Pin` methods under a pinned receiver. It composes with TASK-376.30's written values, so a later assignment is read the same way.

## Measured

Interleaved arms, control `7740c7ce` (TASK-376.30), builds guarded by TASK-376.31.

| Corpus | Resolved | Reasons |
| --- | ---: | --- |
| tokio (`repository-root`) | 8945 → 8952 (+7) | `receiver_type_unknown` −42; `member_type_unknown` +30, `method_not_on_type` +5; 5 edges gained, none lost |
| rustc (376.18's predicate) | 113074 → 113076 (+2) | `receiver_type_unknown` −18; `method_not_on_type` +16; 2 edges gained, none lost |

Most newly typed receivers stop one hop later. In tokio they reach a field the enclosing type does not type (`me.inner.poll()`), and in rustc they call `ManuallyDrop`'s own methods on the wrapper, which the enclosing type does not declare. Both failures are honest: they name the type the binding holds.
<!-- SECTION:NOTES:END -->
