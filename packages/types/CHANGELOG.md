# @ariadnejs/types

## 0.5.9

### Patch Changes

- 4eaa992: Reorganized the project into a monorepo structure with separate packages for core functionality and types.

  - Created `@ariadnejs/core` package containing all implementation code
  - Created `@ariadnejs/types` package with zero-dependency TypeScript types
  - Set up npm workspaces for managing the monorepo
  - Configured changesets for coordinated versioning and releasing
  - Integrated GitHub Actions for automated releases with prebuilt binaries
  - Removed legacy release scripts in favor of changesets workflow
