# @ariadnejs/types

## 0.8.0

### Minor Changes

- 33ff291: Call resolution, Python support, and type system improvements

  **@ariadnejs/core**

  - Add constructor enrichment and function_call module extraction
  - Fix Python instance-method resolution false positives
  - Resolve Python submodule import method calls
  - Resolve aliased re-exports for TypeScript/JavaScript and Python
  - Detect functions passed as values for indirect reachability (fewer false positive entry points)
  - Add multi-candidate resolution foundation
  - Add callback detection and tracking
  - Add factory call tracking for polymorphic resolution
  - Add collection reachability and argument resolution
  - Migrate codebase to snake_case naming convention

  **@ariadnejs/types**

  - Rename ClassDefinition.constructor to constructors (array)
  - Add access_modifier to method and constructor definitions
  - Add is_test field to CallableNode
  - Add ExportableDefinition type guard
  - Merge TypeContext into TypeRegistry
  - Add ResolutionCache
  - Add reference factory functions with discriminated unions

## 0.5.15

### Patch Changes

- 6f659e4: Remove custom prebuild system in favor of tree-sitter's built-in prebuilds

  - Removed custom GitHub Actions prebuild workflow
  - Removed postinstall script and tar dependency
  - Now relies entirely on tree-sitter's native prebuild support

  This is an internal change with no user-facing impact. Installation behavior remains the same.

## 0.5.14

### Patch Changes

- feb54fe: Fix prebuild workflow with C++17 and direct package installation

## 0.5.13

### Patch Changes

- 425941b: Prevent tree-sitter packages from being hoisted to fix prebuild workflow

## 0.5.12

### Patch Changes

- 84d0f91: Fix prebuild workflow to use correct working directory for monorepo structure

## 0.5.11

### Patch Changes

- 5ad3e6c: Testing prebuild workflow after monorepo fixes

## 0.5.10

### Patch Changes

- 6df19fb: Changed npm package scope from `@ariadne/*` to `@ariadnejs/*`

  Due to the `@ariadne` organization already being taken on npm, we've changed our package scope to `@ariadnejs`. Update your imports:

  **Before:**

  ```json
  {
    "dependencies": {
      "@ariadne/core": "^0.5.9",
      "@ariadne/types": "^0.5.9"
    }
  }
  ```

  **After:**

  ```json
  {
    "dependencies": {
      "@ariadnejs/core": "^1.0.0",
      "@ariadnejs/types": "^1.0.0"
    }
  }
  ```

  ```typescript
  // Before
  import { Definition } from "@ariadne/types";
  import { RefScope } from "@ariadne/core";

  // After
  import { Definition } from "@ariadnejs/types";
  import { RefScope } from "@ariadnejs/core";
  ```

## 0.5.9

### Patch Changes

- 4eaa992: Reorganized the project into a monorepo structure with separate packages for core functionality and types.

  - Created `@ariadnejs/core` package containing all implementation code
  - Created `@ariadnejs/types` package with zero-dependency TypeScript types
  - Set up npm workspaces for managing the monorepo
  - Configured changesets for coordinated versioning and releasing
  - Integrated GitHub Actions for automated releases with prebuilt binaries
  - Removed legacy release scripts in favor of changesets workflow
