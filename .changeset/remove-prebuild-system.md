---
"@ariadnejs/core": patch
"@ariadnejs/types": patch
---

Remove custom prebuild system in favor of tree-sitter's built-in prebuilds

- Removed custom GitHub Actions prebuild workflow
- Removed postinstall script and tar dependency
- Now relies entirely on tree-sitter's native prebuild support

This is an internal change with no user-facing impact. Installation behavior remains the same.