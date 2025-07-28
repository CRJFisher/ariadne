# Jest to Vitest Migration Guide

## Overview

This document describes the migration from Jest to Vitest for the Ariadne project. The migration was necessary due to Jest's incompatibility with tree-sitter native modules on Linux (Jest issue #9206).

## Key Changes

### 1. Dependencies

**Removed:**
- `jest`
- `ts-jest`
- `@types/jest`

**Added:**
- `vitest`
- `@vitest/ui`
- `happy-dom` (for DOM testing if needed)

### 2. Configuration

**Removed:**
- `jest.config.js`

**Added:**
- `vitest.config.mjs` - ESM configuration file with:
  - `pool: 'forks'` - Essential for native module compatibility
  - `singleFork: true` - Ensures proper isolation for native modules
  - Setup file at `src/test/setup.ts`
  - Coverage configuration matching Jest's settings

### 3. Package.json Scripts

Updated test scripts:
- `test`: `vitest run` (runs tests once and exits)
- `test:ui`: `vitest --ui` (interactive UI mode)
- `test:coverage`: `vitest --coverage` (coverage reporting)

### 4. CI/CD Updates

- Updated `.github/workflows/test.yml` to test on both Ubuntu and macOS
- No changes needed to test commands as they use `npm test`

## Migration Steps

1. Install Vitest: `npm install --save-dev vitest @vitest/ui happy-dom`
2. Create `vitest.config.mjs` with forks pool configuration
3. Update package.json test scripts
4. Remove Jest dependencies: `npm uninstall jest ts-jest @types/jest`
5. Delete `jest.config.js`
6. Run tests to verify: `npm test`

## Benefits

- **Native Module Support**: Vitest's `forks` pool properly handles tree-sitter native modules
- **Faster Test Execution**: Vitest is built on Vite, providing faster test runs
- **Better ESM Support**: Native ESM support without configuration complexity
- **Compatible API**: Most Jest tests work without modification

## Gotchas

- Vitest config must use `.mjs` extension or add `"type": "module"` to package.json
- The `forks` pool is essential for native modules - don't change to `threads`
- Global test functions are available through the `globals: true` config option