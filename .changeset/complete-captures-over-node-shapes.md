---
"@ariadnejs/types": minor
"@ariadnejs/core": minor
---

Python classes and methods stop disappearing from the call graph when their
syntax takes a shape the queries did not enumerate.

A class whose base is dotted, subscripted or both (`class PGDDLCompiler(compiler.DDLCompiler)`)
is now indexed with every method it declares, where before the class and all
its methods were erased. A method behind any decorator — `@cython.cfunc`,
`@functools.lru_cache()`, `@lru_cache(maxsize=1)`, `@util.memoized_property` —
is indexed the same as an undecorated one, and a `@classmethod` gets the body
scope it needs to be a graph node at all, so the calls it makes are edges.

Reading a Python property (`row.data` where `data` is a `@property`) creates an
edge to the getter, so property getters stop being reported as unreachable.
Method definitions carry `accessor_kind` (`getter`, `setter`, `deleter`), and
the whole property-descriptor family — `cached_property`, `memoized_property`,
`cache_readonly`, `classproperty` — counts as a getter.

A write to a member no longer mints a read of it, so an assignment can no
longer fabricate an edge to the getter that shares its name; a member read
through an ungrounded chain (`getHelper().handler`) mints nothing rather than
resolving its trailing name against an unrelated function.

A Python file whose module-level name is bound more than once — an `@overload`
group, a second wildcard re-export — no longer aborts. Over sqlalchemy's `lib/`
this takes files that fail to index whole from 21 to 0, recovers 4,057
call-graph nodes, and drops the entry-point false-positive rate from 32.4% to
25.2%.

Two changes need attention on upgrade:

- `CURRENT_SCHEMA_VERSION` moves to 5, so an existing on-disk index is
  discarded and the project re-indexes cold on first run.
- `SymbolReference` gains `CallableValueReference` and `accessor_kind` gains
  `"deleter"`. Consumers switching exhaustively over either need a new arm.
