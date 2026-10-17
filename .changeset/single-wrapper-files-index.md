---
"@ariadnejs/core": patch
---

A project containing a very large file written as one wrapper — lodash's
`test/test.js`, a UMD bundle, a `;(function(){ ... }.call(this))` module — now
indexes instead of killing the process with SIGSEGV. Before, the crash lost
every file, call edge and entry point in the run, with no message naming the
file. Indexing is also faster across the board: `lodash.js` indexes in 1.8 s
where it took 10.9 s.

Rust definitions keep everything their item declares. Generic traits, enums and
functions record their type parameters, generic `async`/`const`/`unsafe`
functions and trait-impl methods keep their doc comments, and `async` methods
are recorded as `async`. Calls through a generic bound that failed to resolve
now resolve, removing false entry points such as an `Executor` trait's
`execute` reached from a generic `async fn`.

`tree-sitter` is 0.25.1, which installs from prebuilt binaries on darwin, linux
and win32 (x64 and arm64) instead of compiling the binding from source.
Indexing output is unchanged by the upgrade.
