# Task: Fix language_configs Capture Mappings

**Task ID**: task-epic-11.92.7.4
**Parent**: task-epic-11.92.7
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Fix TypeScript error in language_configs/python.ts where CaptureMapping context function returns incompatible type.

## Problem

Line 156: TS2769 - No overload matches this call for Map constructor with CaptureMapping entries.

The issue stems from a context function returning `CaptureContext | undefined` when `CaptureContext` is required:
```typescript
context: (node: SyntaxNode) => CaptureContext | undefined
// But interface expects:
context: (node: SyntaxNode) => CaptureContext
```

## Root Cause

The CaptureMapping interface has inconsistent handling of optional context:
1. Some mappings have `context` functions that can return undefined
2. The Map constructor expects all mappings to return definite CaptureContext
3. Type inference fails due to this mismatch

## Solution Approach

1. **Option A: Make context return type consistent**
   ```typescript
   // Ensure all context functions return CaptureContext
   context: (node: SyntaxNode) => CaptureContext {
     // Return default context if none found
     return specificContext || DEFAULT_CONTEXT;
   }
   ```

2. **Option B: Update CaptureMapping interface**
   ```typescript
   interface CaptureMapping {
     category: SemanticCategory;
     entity: SemanticEntity;
     context?: (node: SyntaxNode) => CaptureContext | undefined;
   }
   ```

3. **Option C: Filter mappings before Map creation**
   ```typescript
   const validMappings = mappings.filter(([_, mapping]) =>
     !mapping.context || mapping.context(node) !== undefined
   );
   new Map(validMappings);
   ```

## Implementation Steps

1. **Analyze CaptureMapping usage** (30 min)
   - Review all language configs
   - Determine if undefined is valid
   - Check consumer expectations

2. **Implement chosen solution** (1 hour)
   - Update type definitions if needed
   - Fix context functions
   - Ensure consistency across languages

3. **Test all language configs** (30 min)
   - Verify Python config works
   - Check JavaScript/TypeScript configs
   - Test Rust config

## Detailed Fix

```typescript
// Current problematic code
const CAPTURE_MAPPINGS = new Map([
  ["call.function", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CALL,
    context: (node: SyntaxNode) => {
      // May return undefined
      return getCallContext(node);
    }
  }],
  // ...
]);

// Fixed version - Option A
const CAPTURE_MAPPINGS = new Map([
  ["call.function", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CALL,
    context: (node: SyntaxNode) => {
      const ctx = getCallContext(node);
      if (!ctx) {
        // Return default context instead of undefined
        return {
          type: 'unknown',
          scope: 'local'
        } as CaptureContext;
      }
      return ctx;
    }
  }],
  // ...
]);

// Fixed version - Option B (if interface updated)
const CAPTURE_MAPPINGS = new Map<string, CaptureMapping>([
  ["call.function", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CALL,
    // Optional context is OK with updated interface
    context: (node: SyntaxNode) => getCallContext(node)
  }],
  // ...
]);
```

## Success Criteria

- [ ] TS2769 error in python.ts resolved
- [ ] All language configs compile
- [ ] Context handling consistent across languages
- [ ] No functionality lost
- [ ] Tests pass for all language configs

## Files to Modify

- `src/semantic_index/language_configs/python.ts`
- Potentially other language config files for consistency
- Possibly `src/semantic_index/types.ts` if interface needs update

## Testing

```bash
# Verify compilation
npm run build

# Test Python parsing
npx vitest run src/semantic_index/language_configs/python.test.ts

# Test all language configs
npx vitest run src/semantic_index/language_configs/
```

## Dependencies

- May affect other language configs
- Could impact semantic index processing

## Notes

- Consider if undefined context is semantically valid
- Document the decision on handling missing context
- Ensure fix doesn't break existing parsing logic
- May need to coordinate with semantic index team