# Task: Evaluate TSX and TypeScript Grammar Separation

**Status**: To Do
**Priority**: Medium
**Created**: 2025-10-08
**Related**: task-epic-11.122

## Problem

The tree-sitter-typescript package defines two separate grammars:
- `TypeScript.typescript` - for `.ts` files
- `TypeScript.tsx` - for `.tsx` files (TSX is a dialect with JSX syntax)

Currently, the codebase uses a single "typescript" language designation and defaults to `TypeScript.typescript` grammar for all TypeScript files. This may cause issues with `.tsx` files that contain JSX syntax.

### Reference from tree-sitter-typescript

From the official tree-sitter-typescript repository:

```
TypeScript and TSX grammars for tree-sitter.

Because TSX and TypeScript are actually two different dialects, this module defines two grammars. Require them as follows:

require("tree-sitter-typescript").typescript; // TypeScript grammar
require("tree-sitter-typescript").tsx; // TSX grammar
```

## Current State

**query_loader.ts** (line 16):
```typescript
export const LANGUAGE_TO_TREESITTER_LANG = new Map([
  ["javascript", JavaScript],
  ["typescript", TypeScript.typescript],  // Using .typescript for all TypeScript files
  ["python", Python],
  ["rust", Rust],
]);
```

**Implications**:
- `.ts` files work correctly
- `.tsx` files may not parse JSX syntax correctly
- Query patterns may not match TSX-specific node types

## Investigation Required

### 1. Determine if TSX support is needed

- [ ] Survey codebase usage patterns - do users analyze `.tsx` files?
- [ ] Check if current grammar handles basic JSX syntax
- [ ] Identify any reported issues with `.tsx` file analysis

### 2. Technical evaluation

- [ ] Compare AST node types between `TypeScript.typescript` and `TypeScript.tsx`
- [ ] Test whether `TypeScript.typescript` grammar can parse `.tsx` files
- [ ] Identify which query patterns would differ between grammars
- [ ] Assess whether separate query files are needed

### 3. Design options

**Option A: File extension-based grammar selection**
- Detect `.tsx` vs `.ts` extension
- Load appropriate grammar based on extension
- Pros: Correct grammar for each file type
- Cons: More complex, need to pass file extension through

**Option B: Use TSX grammar for all TypeScript**
- Since TSX is a superset, use it for both `.ts` and `.tsx`
- Pros: Simple, handles both file types
- Cons: May parse valid TypeScript differently, slight perf overhead

**Option C: Keep current approach**
- Continue using `TypeScript.typescript` only
- Document limitation with `.tsx` files
- Pros: Simple, works for pure TypeScript
- Cons: May not handle JSX properly

**Option D: Separate language type**
- Add "tsx" as a separate language alongside "typescript"
- Create separate query file `tsx.scm`
- Pros: Clean separation, explicit handling
- Cons: Query duplication, more maintenance

## Testing Requirements

If changes are made:

- [ ] Add integration tests for `.tsx` files with JSX syntax
- [ ] Test that `.ts` files continue to work
- [ ] Verify query patterns match correctly for both grammars
- [ ] Add test cases with:
  - JSX elements
  - TypeScript generics in JSX (`<Component<T> />`)
  - Spread props
  - Fragment syntax

Example test cases:
```tsx
// JSX with TypeScript
const Component = <T,>(props: Props<T>) => {
  return <div>{props.children}</div>;
};

// Generics in JSX
<GenericComponent<string> value="test" />
```

## Acceptance Criteria

- [ ] Decision documented on approach to take
- [ ] If implementing separation:
  - [ ] File extension detection works
  - [ ] Appropriate grammar loaded based on file type
  - [ ] Tests pass for both `.ts` and `.tsx` files
  - [ ] Query patterns updated if needed
- [ ] If keeping current approach:
  - [ ] Limitations documented
  - [ ] Tests confirm `.ts` files work correctly

## Estimated Effort

**Small to Medium** (2-4 hours)
- 1 hour investigation and testing
- 1-2 hours implementation (if changes needed)
- 1 hour testing and documentation

## Priority Justification

**Medium** - Not blocking current functionality since most TypeScript codebases use `.ts` files predominantly. However, should be addressed for completeness if users analyze React/TSX codebases.
