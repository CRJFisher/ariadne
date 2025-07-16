# Troubleshooting: tree-sitter-python CI Test Failures

## Problem Statement

- **Symptom:** Python language parser tests (tree-sitter-python) fail in CI, while JavaScript and TypeScript parser tests pass.
- **Context:** This happens even though all language modules use a similar setup and the relevant `.scm` files are present and readable.

---

## Checklist of Investigated Causes

### 1. SCM File Existence & Readability

- Confirmed: All `scopes.scm` files exist and are readable in CI (JS/TS tests pass, so file loading is not the issue).

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

- **Python tests fail in CI** with zero captures (scopes, defs, etc.), while JS/TS tests pass and show healthy captures.
- This suggests the tree-sitter-python parser is not matching queries or not initializing correctly in CI, despite working locally.

---

## Next Steps / Open Questions

- Add debug output to Python tests to print the parse tree and confirm parser initialization.
- Check that `scopes.scm` queries match the actual grammar node types for the installed tree-sitter-python version.
- Consider differences in CI environment (e.g., locale, file encoding, Node version, etc.).
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
