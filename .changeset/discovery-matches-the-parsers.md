---
"@ariadnejs/core": patch
---

Make file discovery admit exactly the files a grammar parses.

Discovery admitted `.go`, `.java`, `.cpp`, `.c`, `.hpp` and `.h`, which no grammar
parses, so each landed in `dropped_files` and made the coverage warning cry wolf
on any repository containing C or Java. It missed `.mjs`, `.cjs` and `.mdx`, so a
callable whose only caller was an ES-module script had no incoming edge.
`SUPPORTED_EXTENSIONS` is now the set `detect_language` maps to a grammar:
`ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `mdx`, `py` and `rs`. The MCP file
watcher follows the same set.

A directory named `fixtures` is no longer ignored, so the call edges its files
hold count; a `/fixtures` directory still marks its callables as test code.

A file whose rollback throws no longer aborts the whole load.
