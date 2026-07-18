---
paths: packages/types/src/**
---

# Language Annotations in @ariadnejs/types

This package expresses the language axis as embedded annotated unions, not per-language
files. Every union member or field applying to a subset of the four languages carries an
`@language` tag naming them — `type_cast`=typescript, `dunder_protocol`=python,
`path_prefix`=rust.

Use JSDoc (`* @language rust`) where the member already has a doc block, an adjacent line
comment (`// @language python`) otherwise. Separate multiples with commas and no spaces:
`@language javascript,typescript`.

Tag every language-subset member you add or edit. Backfill is incomplete, so
`grep -rn "@language" packages/{types,core}/src` returns the tagged set, not the true set —
every untagged member is a hole in the add-a-language audit. The same tag marks inline
language branches in core: `@.claude/rules/language-patterns.md`.

Enforcement: none — the tag is review-carried.
