# Ariadne Documentation

Welcome to the Ariadne documentation. This directory contains detailed technical documentation about the project's architecture, implementation, and usage.

## Core Documentation

### Architecture & Design
- [Graph Structure](./graph-structure.md) - Understanding the scope graph data structure
- [Scope Mechanism](./scope-mechanism.md) - How scope resolution works
- [Symbol Resolution](./symbol-resolution.md) - Symbol tracking and resolution
- [Tree-sitter Queries](./tree-sitter-queries.md) - Query syntax and patterns

### API Reference
- [API Reference](./api-reference.md) - Complete API documentation
- [Call Graph API](./call-graph-api.md) - Call graph specific APIs

### Features
- [Cross-File Method Resolution](./cross-file-method-resolution.md) - Current state and limitations of method resolution across files
- [Incremental Parsing](./incremental-parsing.md) - How incremental parsing works
- [Language Configuration](./language-configuration.md) - Adding new language support
- [Language Feature Matrix](./language-feature-matrix.md) - Feature support by language

### Technical Deep Dives
- [Method Resolution Implementation](./technical/method-resolution-implementation.md) - Technical details of method resolution

## Development

### Testing
- [Testing Guide](./testing-guide.md) - How to write and run tests

### Releases
- [Release Checklist](./release-checklist.md) - Steps for releasing new versions
- [Releasing](./releasing.md) - Release process documentation
- [Prebuilt Binaries](./prebuild-binaries.md) - Binary distribution

### Migration Guides
- [GitHub Repository Migration](./github-repository-migration-guide.md) - Moving from npm to GitHub
- [NPM Package Migration](./npm-package-migration-guide.md) - Package migration guide
- [Jest to Vitest Migration](./jest-to-vitest-migration.md) - Test framework migration

## Changes & Design Documents

- [Incremental Parsing Design](./changes/incremental-parsing.markdown)
- [Renamed Imports Design](./changes/renamed-imports-design.md)
- [Renamed Imports Implementation](./changes/renamed-imports-implementation.md)