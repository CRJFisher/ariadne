# Task 11.84: Export Detection Module - Post-Refactoring Improvements

## Overview

After completing the initial configuration-driven refactoring of the export_detection module, several issues were identified that need to be addressed to fully complete the refactoring according to best practices.

## Current State

- Module has been refactored into generic (29%) and bespoke (71%) components
- 141 of 149 tests passing (94.6% pass rate)
- Bespoke handlers are larger than ideal (193-473 lines)
- Some patterns in bespoke code could potentially be genericized

## Sub-Tasks

### 11.84.1: Fix Failing TypeScript Namespace Export Tests

**Priority**: HIGH  
**Status**: TODO

Fix 6 failing tests related to TypeScript namespace exports:
- `handle_namespace_exports` - exported namespaces detection
- `handle_namespace_exports` - module declarations detection  
- `handle_namespace_exports` - nested namespaces handling
- `handle_namespace_exports` - namespace member marking
- `handle_declaration_merging` - namespace and function merging
- `get_typescript_bespoke_exports` - all TypeScript patterns

**Root Cause**: AST traversal logic not correctly identifying namespace/module nodes in export statements

### 11.84.2: Fix Failing Rust Use Declaration Tests

**Priority**: HIGH  
**Status**: TODO

Fix 2 failing tests related to Rust pub use declarations:
- `handle_pub_use_reexports` - pub use with alias detection
- `handle_pub_use_reexports` - pub use with list detection

**Root Cause**: Use tree parsing not correctly handling alias patterns and list syntax

### 11.84.3: Review and Reduce JavaScript Bespoke Handler

**Priority**: MEDIUM  
**Status**: TODO  
**Current Size**: 193 lines

Analyze `export_detection.javascript.bespoke.ts` to identify patterns that could be:
1. Moved to configuration (e.g., CommonJS patterns)
2. Genericized with parameterization
3. Shared with TypeScript handler

**Target**: Reduce to <150 lines or justify why code must remain bespoke

### 11.84.4: Review and Reduce TypeScript Bespoke Handler

**Priority**: MEDIUM  
**Status**: TODO  
**Current Size**: 282 lines

Analyze `export_detection.typescript.bespoke.ts` to identify:
1. Type export patterns that could be configuration-driven
2. Namespace handling that could be genericized
3. Declaration merging patterns that could be abstracted

**Target**: Reduce to <200 lines or justify why code must remain bespoke

### 11.84.5: Review and Reduce Python Bespoke Handler

**Priority**: MEDIUM  
**Status**: TODO  
**Current Size**: 289 lines

Analyze `export_detection.python.bespoke.ts` to identify:
1. `__all__` handling patterns that could be genericized
2. Conditional export patterns that could be configuration-driven
3. Decorator patterns that could be abstracted

**Target**: Reduce to <200 lines or justify why code must remain bespoke

### 11.84.6: Review and Reduce Rust Bespoke Handler

**Priority**: MEDIUM  
**Status**: TODO  
**Current Size**: 473 lines (largest)

Analyze `export_detection.rust.bespoke.ts` to identify:
1. Visibility modifier patterns that could move to configuration
2. Use declaration parsing that could be genericized
3. Trait/impl handling that could be abstracted

**Target**: Reduce to <250 lines or justify why code must remain bespoke

### 11.84.7: Extract Common Patterns to Generic Processor

**Priority**: HIGH  
**Status**: TODO

Based on reviews from 11.84.3-6, extract identified common patterns:
1. Create new configuration fields for recurring patterns
2. Add generic helper functions for shared logic
3. Update language_configs.ts with new pattern definitions
4. Move extractable logic from bespoke to generic

**Target**: Achieve closer to 60/40 generic/bespoke split (currently 29/71)

### 11.84.8: Document Bespoke Logic Justification

**Priority**: LOW  
**Status**: TODO

For all logic that must remain bespoke, document:
1. Why it cannot be genericized
2. What makes it truly language-specific
3. Any attempts at genericization that failed and why

Create `export_detection/BESPOKE_JUSTIFICATION.md` with this documentation.

## Success Criteria

- [ ] All 149 tests passing (100%)
- [ ] Each bespoke handler justified or reduced in size
- [ ] Common patterns extracted to generic processor
- [ ] Clear documentation of what must remain bespoke and why
- [ ] Generic/bespoke ratio improved from 29/71 to at least 50/50

## Notes

The original 80/20 generic/bespoke target was a guideline. The key principle is that code should only be bespoke if it truly represents unique language semantics that cannot be expressed through configuration or abstracted into generic patterns. Some languages (especially Rust with its complex visibility system) may legitimately require more bespoke handling.

## Dependencies

- Uses refactoring-recipe.md as guide
- Builds on initial refactoring work
- Must maintain backward compatibility with existing API

## Estimated Effort

- Test fixes: 2-3 hours
- Bespoke reviews: 4-6 hours  
- Pattern extraction: 3-4 hours
- Documentation: 1 hour

Total: 10-14 hours