---
id: TASK-190.16.21
title: '[gap] Add polymorphic-override-hierarchy signals to SignalCheck op union'
status: To Do
assignee: []
created_date: '2026-04-28 09:33'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - abstract-class-polymorphic-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `peer-definition-grep-hits-count`, `receiver-type-is-interface-or-abstract`

The 'abstract-class-polymorphic-dispatch' pattern — an entry is a concrete override of an `abstract` declaration on a superclass, and its real callers dispatch through the abstract base via `this.<name>` in the base class — cannot be expressed with existing SignalCheck ops.

Two complementary ops cover the capability:

(a) `peer-definition-grep-hits-count` — count grep_call_sites whose content matches a method/getter definition heading pattern, whose file_path differs from the entry's, AND whose captures[] is empty. An `at_least n` threshold discriminates the polymorphic-override hierarchy shape.

(b) `receiver-type-is-interface-or-abstract` — for call-refs whose resolved_receiver_type names a class/interface, test whether that type is marked `abstract` or is an `interface` in Ariadne's type registry.

Both ops read information Ariadne already computes but does not surface to classifiers.

Source: triage-curator sweep. Triggering groups: abstract-class-polymorphic-dispatch (nest), polymorphic-interface-dispatch.
<!-- SECTION:DESCRIPTION:END -->
