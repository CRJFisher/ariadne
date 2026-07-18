---
paths: packages/types/src/**
---

# Language Annotations in @ariadnejs/types

This package expresses the language axis as embedded annotated unions, not per-language
files. Every union member or field that applies to a subset of the four languages carries an
`@language` tag naming them.

- Tag form is either JSDoc (`* @language rust`) or an adjacent line comment
  (`// @language python`) — both are current practice.
- Multiple languages are comma-separated with no spaces: `@language javascript,typescript`.
- Live examples: `type_cast` → `@language typescript` (`resolution_failure.ts`),
  `dunder_protocol` → `@language python` (`classified_entry_point.ts`, `known_issues.ts`),
  `path_prefix` → `@language rust` (`symbol_references.ts`).

An unannotated language-specific member makes the add-a-language audit un-enumerable:
`grep -rn "@language" packages/types/src` must return the complete set.

Enforcement: none. No hook or test checks for the tag — this is convention, and the
add-a-language audit is the consumer that silently under-reports when a tag is missing.
`build_stop.ts` catches an unhandled union member, which is a different failure.
