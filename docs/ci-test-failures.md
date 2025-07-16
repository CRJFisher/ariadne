# Troubleshooting: CI Test Failures (Multiple Suites)

## Problem Statement

- **Symptom:** Multiple test suites fail in CI, including but not limited to Python language parser tests. JavaScript tests pass, but failures are seen in TypeScript, Python, and core project tests. The tests all pass locally.
- **Context:** This happens even though all language modules use a similar setup and the relevant `.scm` files are present and readable.

---

## The Core Issue: Discrepancy in Build Environments

After careful review, the root of the problem has been confirmed. **Both the local development environment and the CI environment are building the tree-sitter parsers from source, but they are producing different results.**

- **Local Environment (Tests Pass):**

  - When a developer runs `npm install` locally, the `scripts/postinstall.js` script runs.
  - It first attempts to download pre-built binaries from the project's GitHub Releases.
  - Since a developer working on the library typically doesn't have a release for their current commit, this download step is expected to fail.
  - The script gracefully catches this failure and **falls back to running `npm rebuild`**, compiling the parsers from source using the local machine's toolchain (e.g., Clang on macOS). This process succeeds.

- **CI Environment (Tests Fail):**
  - When `npm ci` runs in GitHub Actions, the `postinstall.js` script sees `process.env.CI` and correctly does nothing, getting out of the way.
  - The standard `npm ci` process then proceeds to compile all tree-sitter modules from source using the CI runner's toolchain (e.g., GCC/g++ on `ubuntu-latest`).
  - **This from-source compilation in CI is the point of failure.** It completes without error but produces non-functional `.node` binaries for TypeScript and Python.

**Conclusion:** The problem is not about one environment using pre-builts while the other doesn't. The problem is a **fundamental incompatibility between the from-source compilation process and the `ubuntu-latest` CI environment**, an issue that does not exist on the developer's macOS environment.

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

- Likely not the issue, as the problem stems from the compiled parser binaries, not the query files.

### 2. Library Version Compatibility

- Confirmed: All tree-sitter and language parser versions in `package.json` are compatible.
- **Current working versions:**
  - `tree-sitter`: `0.21.1`
  - `tree-sitter-javascript`: `0.21.4`
  - `tree-sitter-python`: `0.21.0`
  - `tree-sitter-typescript`: `0.21.2`

### 3. Platform-Appropriate Binaries

- **Clarified:** Both the local environment and the CI environment build from source. The local (macOS) build succeeds, while the CI (Ubuntu) build produces broken binaries.

### 4. Node.js Version Incompatibility

- **Ruled Out:** The CI job was isolated to run only on Node.js 18.x and still failed.

---

## What Still Fails

- **From-source compilation in CI:** The `npm ci` step completes without error, but the resulting parser binaries for TypeScript and Python are non-functional, leading to zero captures in tests.

---

## Next Steps / Open Questions

- **Focus on the CI build environment:** The problem is squarely within the `node-gyp` compilation step on the `ubuntu-latest` runner.
- **Inspect build environment:** Add a CI step to log toolchain versions (`g++ --version`, `make --version`, `python --version`) and compare them to the local machine.
- **Inspect build outputs:** Add a CI step to `ls -laR` the contents of `node_modules/tree-sitter-python/build/Release` after `npm ci` to verify that a `.node` file is actually created and what its permissions are.
- **Capture verbose build logs:** Run `npm ci --verbose` and pipe the output to a file that can be uploaded as a CI artifact. This will allow us to scrutinize the `g++` compilation commands and look for warnings that might be missed.
- **Test a simpler parser:** See if another simple parser (e.g., `tree-sitter-json`) also fails to compile and run correctly, to see how widespread the issue is.

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
