---
id: TASK-350.4
title: >-
  Disposition for the fixture-injected identifier-receiver _repr_html_ residual
  (Shape I, deferred from 350.3)
status: To Do
assignee: []
created_date: "2026-06-29 16:22"
labels:
  - plan-export
  - framework_invoked
  - coverage_config
dependencies: []
parent_task_id: TASK-350
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Spun off from TASK-350.3, which scoped the `untyped-attribute-receiver` interim classifier to the self-attribute shape (Shape S: `self.<attr>.<method>()` on an untyped attribute, e.g. pandas `self.obj._set_value`).

The second row TASK-350.3 named — the fixture-injected Styler `_repr_html_` row (`styler._repr_html_()` in `pandas/tests/io/formats/style/test_style.py`) — is a DIFFERENT diagnostic shape and is deliberately NOT covered by that classifier.

Shape I (this task): the receiver is a bare untyped parameter (a pytest fixture), so the call ref is `receiver_kind: identifier` + `resolution_failure.reason: receiver_type_unknown` with no `resolved_receiver_type` to collapse to. That signal is indistinguishable from the dominant untyped-local-call bucket (~8,500 `receiver_type_unknown` occurrences in the pandas corpus). A shape-based classifier keyed on it would mask thousands of genuine entry points and real bugs — which is why TASK-350.3 excluded it.

Its true root cause is one of:

- the only caller lives in an unindexed test directory (coverage_config fault area), or
- `_repr_html_` is a framework-invoked IPython/Jupyter rich-display protocol method (`_repr_html_`, `_repr_latex_`, `_repr_png_`, `_repr_mimebundle_`, ...) called by the notebook runtime, not user code — a NAME-based classifier concern, analogous to the existing `py-dunder-protocol` builtin (which covers `__x__` dunders but not these single-underscore display methods).

Work: decide the correct disposition (name-based framework-display-protocol classifier vs coverage_config handling), then implement it. Do NOT broaden the `untyped-attribute-receiver` rule to absorb this.

<!-- SECTION:DESCRIPTION:END -->
