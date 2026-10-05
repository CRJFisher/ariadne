---
"@ariadnejs/mcp": patch
---

Refuse a path outside the loaded project instead of answering about a different codebase.

The server loads one project root at startup. A `files` or `folders` argument, or
an absolute `symbol_ref` path, that lies outside that root used to produce an
answer about another tree, or a "Could not find callable" that did not say why.
It now returns an error response naming the offending path and the loaded root.
An empty-string entry in `files` or `folders` is rejected the same way.
