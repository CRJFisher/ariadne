---
"@ariadnejs/core": minor
"@ariadnejs/types": minor
---

Resolve Rust qualified calls, underscore-prefixed imports and self-initialised bindings.

Callees that were reported as unreachable entry points because their call sites
did not bind now have their incoming edge:

- **Rust qualified calls.** `worker::create()`, `Parker::make()`,
  `crate::runtime::Driver::new()` and `Self::assoc()` resolve through their
  qualifier. A call reference carries the terminal `name` and the qualifier in
  the new `path_prefix` on `FunctionCallReference` and `ConstructorCallReference`;
  before, `name` held the whole scoped-path text. A consumer that read `name` as
  the path reads `path_prefix` plus `name`.
- **Associated `new()`** links to its struct as the constructor, so
  `Type::new()` reaches it.
- **Explicit named imports bind regardless of `is_exported`.** `from .x import _y`
  and a non-`pub` Rust item bind to the definition they name. `is_exported` still
  governs the implicit surface of wildcard, namespace and re-export imports.
- **Self-initialisers and nested functions.** `let x = x(...)` calls the imported
  `x`, not the binding it is initialising, in JavaScript, TypeScript and Rust,
  and a function declared in a nested block is visible to its sibling scopes.

Cached per-file indexes written by the previous indexer are discarded, and each
file is re-indexed once.
