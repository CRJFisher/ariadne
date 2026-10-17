---
"@ariadnejs/core": minor
---

Follow module edges the index used to drop, so more callees gain a caller.

A callee reached through any of these used to look uncalled and was reported as
an entry point; it now has its incoming edge.

- **Wildcard and namespace re-exports.** `export * from './impl'`,
  `import * as X from './m'; export { X }`, Python `from pkg import *` (including
  several in one file) and Rust `pub use m::*` are recorded as module edges,
  and the export surface fans out across them. A file with two wildcard imports
  no longer fails to index.
- **TypeScript workspaces.** A per-package `tsconfig` that declares no `paths`
  inherits them through `extends`, from any number of directories up. A workspace
  package resolves through its `package.json` `exports` map (the `"."` form, the
  condition-only form and published subpaths). Bare specifiers resolve through
  `paths` and package names.
- **Rust.** A `mod x;` links to the file backing it, honouring `#[path = "..."]`.
  Every `::` path resolves through one resolver: `crate::`, `self::`,
  `Self::`, type-qualified associated items and a crate named by another
  workspace member.
- **Order independence.** A caller indexed before its callee's file is re-resolved
  when that file arrives, without a whole-corpus pass.

`Project.initialize` now reads `tsconfig.json`/`jsconfig.json`, `package.json`
and `Cargo.toml` once to learn which directory a package or crate name denotes;
an unreadable manifest is skipped, and a specifier matching nothing on disk
stays unresolved rather than inventing an edge.

Cached per-file indexes written by the previous indexer are discarded, and each
file is re-indexed once.
