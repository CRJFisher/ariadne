# task-epic-11.95.5 - Implement Rust Module and Visibility System

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust module system including use statements, re-exports, visibility modifiers, and extern crate declarations.

## Current Failing Tests
- `should parse use statements and imports` - "Display" import not found
- `should parse re-exports and pub use statements` - pub use captures missing
- `should capture extern crate and module declarations` - extern crate missing
- `should capture visibility modifiers` - visibility modifiers not detected

## Specific Issues to Fix

### Use Statements Not Fully Captured
```rust
use std::fmt::Display;
use std::collections::{HashMap, HashSet};
use super::utils::*;
```
- **Expected**: "Display" import should be found in imports
- **Current**: Some imports not detected

### Pub Use Re-exports Missing
```rust
pub use crate::internal::PublicApi;
pub use std::collections::HashMap as Map;
```
- **Expected**: pub use captures should be > 0 with `is_reexport: true`
- **Current**: 0 pub use captures found

### Visibility Modifiers Not Detected
```rust
pub struct Public {}
pub(crate) struct CrateVisible {}
pub(super) struct SuperVisible {}
```
- **Expected**: Visibility modifiers captured and categorized
- **Current**: 0 visibility modifiers found

### Extern Crate Missing
```rust
extern crate serde;
extern crate tokio as async_runtime;
```
- **Expected**: External crate dependencies captured
- **Current**: extern crate declarations not found

## Implementation Details

### Tree-sitter Patterns Needed
1. **Use Declarations**: `use path::item;`
2. **Use Groups**: `use path::{item1, item2};`
3. **Use Aliases**: `use path::item as alias;`
4. **Pub Use**: `pub use path::item;`
5. **Visibility Modifiers**: `pub`, `pub(crate)`, `pub(super)`, `pub(in path)`
6. **Extern Crate**: `extern crate name;`, `extern crate name as alias;`
7. **Module Declarations**: `mod name;`, `mod name { ... }`

### Query Patterns to Add to rust.scm
```scheme
; Use declarations
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.path
    list: (use_list
      (scoped_identifier) @import.name)*)) @import.declaration

; Simple use statements
(use_declaration
  argument: (scoped_identifier
    path: (_) @import.path
    name: (identifier) @import.name)) @import.declaration

; Use with aliases
(use_declaration
  argument: (use_as_clause
    path: (scoped_identifier) @import.original
    alias: (identifier) @import.alias)) @import.declaration

; Pub use re-exports
(use_declaration
  "pub" @export.visibility
  argument: (_) @export.item) @export.reexport

; Visibility modifiers
(visibility_modifier
  "pub" @visibility.public) @visibility.modifier

(visibility_modifier
  "pub" @visibility.public
  (crate) @visibility.scope) @visibility.crate_modifier

(visibility_modifier
  "pub" @visibility.public
  (super) @visibility.scope) @visibility.super_modifier

; Extern crate
(extern_crate_declaration
  "extern" @extern.keyword
  "crate" @extern.type
  name: (identifier) @extern.name) @extern.declaration

; Extern crate with alias
(extern_crate_declaration
  "extern" @extern.keyword
  "crate" @extern.type
  name: (identifier) @extern.original
  alias: (identifier) @extern.alias) @extern.declaration

; Module declarations
(mod_item
  "mod" @module.keyword
  name: (identifier) @module.name) @module.declaration
```

### Modifier Support Needed
- `is_reexport`: boolean for pub use statements
- `visibility_level`: "public" | "crate" | "super" | "private" | "restricted"
- `visibility_scope`: scope path for restricted visibility
- `is_extern_crate`: boolean for external crate dependencies
- `import_alias`: alias name if different from original
- `module_type`: "inline" | "file" | "directory"

## Files to Modify

### Primary Implementation
- `src/semantic_index/queries/rust.scm` - Add module/visibility patterns
- `src/semantic_index/capture_types.ts` - Add module system modifiers

### Testing Infrastructure
- `src/semantic_index/language_configs/rust.test.ts` - Add test cases for use statements, re-exports, and visibility modifiers
- Test fixtures - Add comprehensive Rust module examples including complex import/export scenarios

### Processing Module Integration
- `src/semantic_index/import_export/` - Update to handle Rust use statements and pub use re-exports
- `src/semantic_index/symbol_extraction/` - Ensure module symbols are properly extracted
- `src/semantic_index/scope_analysis/` - Process module scopes and visibility boundaries

### Symbol Resolution Integration
- `src/symbol_resolution/import_resolution/` - Handle Rust import resolution and path traversal
- `src/symbol_resolution/module_resolution/` - Support module path resolution across crates
- `src/symbol_resolution/scope_analysis/` - Update visibility-aware symbol lookup
- `src/symbol_resolution/definition_finder/` - Enable cross-module symbol resolution

## Acceptance Criteria
- [ ] All use statements captured including grouped imports
- [ ] Import aliases properly detected and stored
- [ ] Pub use re-exports captured with `is_reexport: true`
- [ ] Visibility modifiers detected and categorized
- [ ] Extern crate declarations captured
- [ ] Module declarations properly identified
- [ ] All 4 failing tests pass
- [ ] No regression in existing Rust parsing

## Call Graph Detection Benefits

This implementation is essential for call graph analysis by:

1. **Cross-Module Call Tracking**: Enables tracking function calls across module boundaries
   - `use crate::other::function` imports enable cross-module call resolution
   - Call graph can trace calls between different modules and crates

2. **Re-export Call Resolution**: Supports method calls through pub use re-exports
   - `pub use internal::API` re-exports enable call tracking through public interfaces
   - Call graph can resolve calls to re-exported functions

3. **Visibility-Aware Call Analysis**: Ensures only visible symbols are considered in call resolution
   - `pub(crate)` and `pub(super)` modifiers restrict call graph scope appropriately
   - Private functions are excluded from cross-module call analysis

4. **External Crate Call Tracking**: Foundation for tracking calls to external dependencies
   - `extern crate` declarations enable call resolution to external libraries
   - Call graph can model dependencies on external crates

5. **Module Path Call Resolution**: Enables resolution of fully qualified function calls
   - `std::collections::HashMap::new()` calls become resolvable through path analysis
   - Complex module paths are properly resolved for call tracking

6. **Import Alias Call Handling**: Supports method calls through import aliases
   - `use HashMap as Map` aliases enable call resolution through renamed imports
   - Call graph correctly maps aliased calls to original definitions

**End-to-End Flow**: Tree-sitter captures module patterns → Semantic index tracks imports/exports → Symbol resolution handles module paths → Call graph tracks cross-module function calls

## Technical Approach
1. **Study Module AST**: Analyze tree-sitter representation of module constructs
2. **Implement Use Statements**: Start with basic use declarations
3. **Add Grouped Imports**: Handle complex import patterns
4. **Capture Visibility**: Implement visibility modifier detection
5. **Handle Re-exports**: Ensure pub use statements are properly marked

## Dependencies
- Understanding of Rust module system and visibility rules
- Knowledge of import/export semantics
- Tree-sitter patterns for path and identifier matching

## Success Metrics
- 4 failing tests become passing
- Complete import/export tracking including aliases
- Proper visibility level detection and categorization
- External dependency tracking through extern crate

## Notes
- Module system is crucial for cross-file analysis
- Visibility affects symbol resolution scope
- Re-exports need to be distinguished from regular imports
- Consider integration with symbol resolution for path traversal