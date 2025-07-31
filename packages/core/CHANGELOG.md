# @ariadnejs/core

## 0.5.18

### Patch Changes

- 7e494f4: Improve documentation and fix server regression

  - Moved detailed API documentation from main README to core package README
  - Simplified main README to be a high-level project overview with links to packages
  - Enhanced core README with comprehensive API documentation, method descriptions, and usage examples
  - Updated MCP README to only document the implemented get_symbol_context tool
  - Fixed server.ts to use VERSION import instead of hardcoded 0.5.12
  - Fixed regression where CLI binary had old position-based tools instead of new context-oriented tools

## 0.5.17

### Patch Changes

- 9f35dbd: Complete get_symbol_context MCP tool with full inheritance support

  - **@ariadnejs/core**: Fixed interface inheritance extraction for TypeScript interfaces that extend other interfaces
  - **@ariadnejs/core**: Extended inheritance APIs to support interface hierarchies in get_inheritance_chain() and find_subclasses()
  - **@ariadnejs/mcp**: Updated get_symbol_context to use enclosing_range for full function body extraction
  - **@ariadnejs/mcp**: Added class/interface inheritance relationships to symbol context using new core APIs
  - **@ariadnejs/mcp**: Added support for Rust struct and trait analysis
  - **@ariadnejs/mcp**: Added comprehensive tests for function body extraction and inheritance relationships

  Completes task-54.1 with all acceptance criteria met. Performance remains under 200ms.

## 0.5.16

### Patch Changes

- d244119: Remove deprecated find_all_references alias - use find_references instead

## 0.5.15

### Patch Changes

- 6f659e4: Remove custom prebuild system in favor of tree-sitter's built-in prebuilds

  - Removed custom GitHub Actions prebuild workflow
  - Removed postinstall script and tar dependency
  - Now relies entirely on tree-sitter's native prebuild support

  This is an internal change with no user-facing impact. Installation behavior remains the same.

- Updated dependencies [6f659e4]
  - @ariadnejs/types@0.5.15

## 0.5.14

### Patch Changes

- feb54fe: Fix prebuild workflow with C++17 and direct package installation
- Updated dependencies [feb54fe]
  - @ariadnejs/types@0.5.14

## 0.5.13

### Patch Changes

- 425941b: Prevent tree-sitter packages from being hoisted to fix prebuild workflow
- Updated dependencies [425941b]
  - @ariadnejs/types@0.5.13

## 0.5.12

### Patch Changes

- 84d0f91: Fix prebuild workflow to use correct working directory for monorepo structure
- Updated dependencies [84d0f91]
  - @ariadnejs/types@0.5.12

## 0.5.11

### Patch Changes

- 5ad3e6c: Testing prebuild workflow after monorepo fixes
- Updated dependencies [5ad3e6c]
  - @ariadnejs/types@0.5.11

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

- Updated dependencies [6df19fb]
  - @ariadnejs/types@0.5.10

## 0.5.9

### Patch Changes

- 4eaa992: Reorganized the project into a monorepo structure with separate packages for core functionality and types.

  - Created `@ariadnejs/core` package containing all implementation code
  - Created `@ariadnejs/types` package with zero-dependency TypeScript types
  - Set up npm workspaces for managing the monorepo
  - Configured changesets for coordinated versioning and releasing
  - Integrated GitHub Actions for automated releases with prebuilt binaries
  - Removed legacy release scripts in favor of changesets workflow
