---
"@ariadnejs/core": patch
---

Keep a declared receiver type that indexing used to lose, so the members called on it stop being reported as entry points.

- **TypeScript optional constructor parameter-properties.**
  `constructor(private readonly store?: Store)` now declares the `store` field with
  its type, as the required form always did.
- **JavaScript JSDoc.** A parameter typed only by a `@param {T} name` tag takes
  that type, so `name.method()` resolves.
- **Python attributes assigned outside `__init__`.** `self.df = pd.DataFrame()` in
  any method of the class declares `df` with type `DataFrame`. An untyped
  assignment outside `__init__` stays a mutation, not a declaration, and a
  `self.x` in a nested function does not leak into the class.

Cached per-file indexes written by the previous indexer are discarded, and each
file is re-indexed once.
