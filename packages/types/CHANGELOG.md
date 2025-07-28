# @ariadnejs/types

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
