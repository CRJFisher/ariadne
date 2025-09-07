# Task 11.84.3: Review and Optimize Bespoke Handlers

## Overview

Review all bespoke handlers to identify patterns that could be moved to configuration or genericized. Currently, bespoke code represents 71% of the module (opposite of the intended ratio).

## Current State

| Language   | File Size | Target | Reduction Needed |
|------------|-----------|--------|------------------|
| JavaScript | 193 lines | <150   | 43 lines (22%)   |
| TypeScript | 282 lines | <200   | 82 lines (29%)   |
| Python     | 289 lines | <200   | 89 lines (31%)   |
| Rust       | 473 lines | <250   | 223 lines (47%)  |

Total: 1,237 lines of bespoke code vs 511 lines of generic code (71% vs 29%)

## Analysis Areas

### JavaScript Bespoke (193 lines)

**Potentially Genericizable:**
1. **CommonJS patterns** (lines 17-83)
   - `module.exports = value` patterns could be configuration-driven
   - `exports.name = value` patterns are just assignment patterns
   - Could define in config: `commonjs_patterns: { default: 'module.exports', named: 'exports.' }`

2. **Complex re-exports** (lines 91-134)
   - Default re-export handling might be configuration-driven
   - Pattern: `export { default } from './module'`

**Must Remain Bespoke:**
- Dynamic exports with computed property names (truly runtime-dependent)

### TypeScript Bespoke (282 lines)

**Potentially Genericizable:**
1. **Type export patterns** (lines 22-76)
   - `export type { }` syntax could be configuration-driven
   - Similar to regular exports but with 'type' keyword

2. **Namespace body traversal** (lines 103-165)
   - Generic pattern: container with nested exports
   - Could be abstracted as "scoped export container"

**Must Remain Bespoke:**
- Declaration merging (unique TypeScript feature)
- Complex namespace nesting with multiple declaration types

### Python Bespoke (289 lines)

**Potentially Genericizable:**
1. **__all__ list parsing** (lines 17-96)
   - Basic list assignment could be configuration
   - Pattern: `special_var = [list_of_strings]`

2. **Star imports** (lines 158-189)
   - Pattern: `from module import *`
   - Could be in config as import pattern

**Must Remain Bespoke:**
- Dynamic __all__ modifications (append/extend)
- Conditional exports (if statements)
- Decorator-based exports (runtime metadata)

### Rust Bespoke (473 lines - LARGEST)

**Potentially Genericizable:**
1. **Visibility modifiers** (lines 22-57)
   - Pattern matching for `pub`, `pub(crate)`, etc.
   - Could be configuration: `visibility_patterns: ['pub', 'pub(crate)', ...]`

2. **Basic pub use** (lines 65-100)
   - Without complex aliases/lists
   - Pattern: `pub use path::item`

3. **Module exports** (lines 216-257)
   - Similar to namespace handling
   - Pattern: visibility + module + body

**Must Remain Bespoke:**
- Complex use tree parsing (lists, aliases, globs)
- Macro exports (requires attribute checking)
- Trait implementations (complex type relationships)

## Proposed Extractions

### Phase 1: Quick Wins (Est. 200 lines reduction)

1. **Extract visibility patterns to config**
   - Move Rust visibility checking to configuration
   - Add `visibility_patterns` to language config
   - Generic function: `check_visibility_pattern(node, config)`

2. **Extract assignment patterns**
   - CommonJS `module.exports` and `exports.x`
   - Python `__all__ = []` basic case
   - Generic function: `check_assignment_export(node, config)`

3. **Extract container patterns**
   - TypeScript namespaces (basic case)
   - Rust modules (basic case)
   - Generic function: `process_export_container(node, config)`

### Phase 2: Complex Patterns (Est. 150 lines reduction)

1. **Parameterize re-export patterns**
   - Extract re-export detection to config
   - Support various re-export syntaxes

2. **Generic list processing**
   - Extract list/array parsing logic
   - Support Python __all__, Rust use lists

3. **AST traversal patterns**
   - Extract common traversal patterns
   - Parameterize node type checks

## Implementation Strategy

1. **Identify exact duplicates**: Find identical logic across languages
2. **Abstract similar patterns**: Create generic functions with config
3. **Measure impact**: Track line reduction and complexity
4. **Maintain tests**: Ensure no regression

## Success Metrics

- [ ] Reduce total bespoke lines by 30-40% (370-495 lines)
- [ ] Achieve 50/50 or better generic/bespoke ratio
- [ ] No loss of functionality
- [ ] All tests continue passing
- [ ] Document why remaining code must be bespoke

## Priority

MEDIUM - Important for maintainability but not blocking functionality

## Notes

Remember: The goal is not to force everything into configuration, but to identify truly generic patterns. Some bespoke code is legitimate - the key is ensuring it's truly unique to that language's semantics.