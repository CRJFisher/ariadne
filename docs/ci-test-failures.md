# Troubleshooting: CI Test Failures (Multiple Suites)

## Problem Statement

- **Symptom:** Multiple test suites fail in CI, including but not limited to Python language parser tests. JavaScript tests pass, but failures are seen in TypeScript, Python, and core project tests. The tests all pass locally.
- **Context:** This happens even though all language modules use a similar setup and the relevant `.scm` files are present and readable.

---

## Comprehensive List of All Failing Tests

### src/index.test.ts (Project - Cross-file resolution)

- finds definition across files
- finds all references across files
- handles renamed imports
- handles default exports
- handles mixed exports
- handles circular imports
- finds references in same file
- handles file updates

### src/incremental.test.ts (Incremental Parsing)

- incremental update handles multi-line changes
- handles edits at file boundaries
- preserves cross-file references after incremental update
- An unnamed test checking reference counts also failed.

### src/languages/python/python.test.ts (Python language support)

- basic function definitions and parameters
- imports and type annotations
- class definitions and methods
- lambda functions and circular references
- decorators
- type aliases
- global and nonlocal keywords
- various Python-specific constructs

### src/languages/typescript/typescript.test.ts (TypeScript parsing)

- simple
- tsx
- function and type params
- optional param regression

---

## Checklist of Investigated Causes

### 1. SCM File Existence & Readability

- Have tried reading the files in many different ways... can't confirm this or isn't the issue.

### 2. Library Version Compatibility

- Confirmed: All tree-sitter and language parser versions in `package.json` are compatible (see current versions below).
- **Current working versions:**
  - `tree-sitter`: `0.21.1`
  - `tree-sitter-javascript`: `0.21.4`
  - `tree-sitter-python`: `0.21.0`
  - `tree-sitter-typescript`: `0.21.2`

### 3. Platform-Appropriate Binaries

- Confirmed: CI workflow uses platform-appropriate binaries (via prebuild or native compilation).
- All build tools and Python are installed in CI.

---

## What Still Fails

- **Multiple test suites fail in CI** (not just Python), with zero or incorrect captures (scopes, defs, etc.), while JS tests pass and show healthy captures.
- This suggests a possible issue with the tree-sitter parser initialization, query matching, or a CI-specific environment/configuration problem affecting multiple languages.

---

## Next Steps / Open Questions

- Add debug output to failing tests to print the parse tree and confirm parser initialization for each language.
- Check that all `scopes.scm` queries match the actual grammar node types for the installed tree-sitter language versions.
- Consider differences in CI environment (e.g., locale, file encoding, Node version, etc.).
- Investigate if there is a shared root cause (e.g., environment variable, file system, or Node.js version) affecting all non-JS parsers.
- ???

---

## How to Avoid Debugging Loops

- **Always check:**
  1. SCM file existence/readability
  2. Library version compatibility
  3. Platform-specific binary issues
  4. Query/grammar compatibility
  5. Parser initialization and parse tree output
- Document any new findings or fixes in this file.

---

## References

- [tree-sitter-python NPM](https://www.npmjs.com/package/tree-sitter-python)
- [tree-sitter NPM](https://www.npmjs.com/package/tree-sitter)
- [tree-sitter docs](https://tree-sitter.github.io/tree-sitter/)
