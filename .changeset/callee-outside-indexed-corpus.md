---
"@ariadnejs/core": minor
"@ariadnejs/types": minor
---

Say that a callee is outside the indexed corpus instead of blaming the type or the scope.

A call to `os.getcwd()`, `np.arange(3)`, `fs.readFileSync(p)` or a method inherited
from an unindexed base such as `unittest.TestCase` can never resolve, because
the callee is defined where no indexed file holds it. It used to be reported as
`name_not_in_scope` or `method_not_on_type`, which read as a resolver defect.
Now:

- A call through an import whose module names no indexed file fails
  `import_unresolved`, carrying the module as the import wrote it in
  `import_specifier`. `import_target_file` is set only when the project indexed
  that file.
- A name the language binds itself (`len`, `console`, `Some`) fails the new
  `callee_is_a_language_global`. `is_language_global(language, name)` is exported
  from `@ariadnejs/types`.
- Both route to the new `outside_indexed_corpus` fault area, which owns no module
  and maps to the empty folder in `ARIADNE_FAULT_AREA_FOLDER`. `import_unresolved`
  no longer maps to `import_resolution`.

`name_not_in_scope` and `method_not_on_type` now count only what the resolver
could have bound.

Resolution itself is unchanged: resolved calls, the call-edge fingerprint and the
raw-entry-point fingerprint are identical on the ten evidence corpora.

A caller that switches exhaustively over `ResolutionFailureReason` or
`AriadneFaultArea` needs an arm for each new member, and one that read
`import_target_file` as "the file the import names" must read `import_specifier`
for an import that leads outside the corpus. Angular's Jasmine globals (`expect`,
`it`) stay `name_not_in_scope`: no import binds them and no test-framework global
set is consulted.
