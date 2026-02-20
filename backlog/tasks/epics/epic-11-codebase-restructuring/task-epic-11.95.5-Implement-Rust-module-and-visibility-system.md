# task-epic-11.95.5 - Implement Rust Module and Visibility System

## Status
- **Status**: `Completed`
- **Assignee**: claude-code
- **Priority**: `Medium`
- **Size**: `M`
- **Parent**: task-epic-11.95

## Description
Implement tree-sitter query patterns for Rust module system including use statements, re-exports, visibility modifiers, and extern crate declarations.

## Implementation Results

### ✅ Tests Now Passing
All 4 failing tests have been successfully fixed:
- ✅ `should parse use statements and imports` - All imports including Display, HashMap now properly detected with aliases and wildcards
- ✅ `should parse re-exports and pub use statements` - Pub use captures working with proper `is_pub_use` and `alias` context flags
- ✅ `should capture extern crate and module declarations` - External crate declarations properly captured
- ✅ `should capture visibility modifiers` - All visibility modifiers (pub, pub(crate), pub(super)) detected

### Changes Made

#### 1. Enhanced Import Patterns (`rust.scm`)
- **Use Statements**: Added comprehensive patterns for scoped identifiers, simple identifiers, and nested imports
- **Aliases**: Fixed use_as_clause patterns to match AST structure without invalid field references
- **Wildcards**: Implemented wildcard import detection (`use std::collections::*`)
- **Lists**: Added support for grouped imports (`use std::{HashMap, HashSet}`)

```scheme
; Simple use statements with full path
(use_declaration
  argument: (scoped_identifier
    (identifier) @import.name
  )
) @import.declaration

; Use with alias
(use_declaration
  argument: (use_as_clause
    (scoped_identifier
      name: (identifier) @import.source
    )
    "as"
    (identifier) @import.alias
  )
) @import.declaration.aliased

; Wildcard imports
(use_declaration
  argument: (use_wildcard) @import.wildcard
) @import.wildcard.declaration
```

#### 2. Fixed Visibility Modifiers (`rust.scm`)
- **Public**: Plain `pub` visibility
- **Crate**: `pub(crate)` visibility
- **Super**: `pub(super)` visibility
- **Restricted**: `pub(in path)` visibility
- **Self**: `pub(self)` visibility

```scheme
; Public visibility (plain pub)
(visibility_modifier
  "pub"
) @visibility.public

; Crate visibility - pub(crate)
(visibility_modifier
  (crate) @visibility.scope.crate
) @visibility.crate
```

#### 3. Improved Re-export Detection (`rust.scm` & `rust.ts`)
- **Aliased**: `pub use foo as bar` patterns
- **Simple**: `pub use foo` patterns
- **Lists**: `pub use foo::{a, b}` patterns
- **Context**: Added proper `is_pub_use` and `alias` context flags

#### 4. Extern Crate Patterns (`rust.scm`)
- **Simple**: `extern crate foo;`
- **Aliased**: `extern crate foo as bar;`

#### 5. Configuration Updates (`rust.ts`)
- Added configurations for all new capture patterns
- Fixed context functions to properly set visibility levels and alias flags
- Resolved conflicts between duplicate `export.pub_use` definitions

### Issues Encountered

#### 1. Tree-sitter Query Syntax Errors
- **Issue**: Invalid field references like `path:` and `name:` in query patterns
- **Solution**: Analyzed AST structure with tree-sitter parser to understand actual node fields
- **Resolution**: Removed invalid field syntax, used direct child node matching

#### 2. Visibility Modifier AST Structure
- **Issue**: Original patterns used incorrect negation syntax (`!crate`)
- **Solution**: Examined actual AST for `pub(crate)` constructs
- **Resolution**: Used direct child matching for crate/super keywords within visibility_modifier

#### 3. Configuration Conflicts
- **Issue**: Duplicate `export.pub_use` configurations causing conflicts
- **Solution**: Commented out conflicting configuration, kept the one with visibility logic
- **Resolution**: Single coherent configuration with proper context functions

#### 4. Use Clause Field References
- **Issue**: `use_as_clause` patterns using invalid `path:` and `alias:` field syntax
- **Solution**: Analyzed use statement AST to find correct structure
- **Resolution**: Direct child matching with explicit "as" keyword detection

### Follow-on Work Needed

#### 1. Module Path Resolution
- Current implementation captures imports but doesn't resolve full module paths
- Need integration with symbol resolution for cross-module call tracking
- Should handle `crate::`, `self::`, `super::` path prefixes

#### 2. Crate-level Import Tracking
- External crate imports captured but not integrated with dependency analysis
- Need mapping from `extern crate` to actual crate dependencies
- Should connect with `Cargo.toml` analysis for complete dependency graph

#### 3. Visibility-aware Symbol Resolution
- Visibility modifiers captured but not used in symbol lookup
- Need integration with scope analysis to respect visibility boundaries
- Should prevent access to private symbols across module boundaries

#### 4. Re-export Chain Resolution
- Pub use re-exports detected but not linked to original symbols
- Need transitive resolution through re-export chains
- Important for accurate call graph analysis through public APIs

### Technical Implementation Notes

#### Query Pattern Simplification
- Started with complex field-based patterns that didn't match AST structure
- Evolved to simpler direct child matching for reliability
- Tree-sitter AST analysis was crucial for understanding actual node structure

#### Configuration Architecture
- Multiple capture points needed for comprehensive coverage
- Context functions essential for adding semantic information
- Avoided duplicate configurations to prevent conflicts

#### Testing Strategy
- Debug scripts were essential for understanding what was being captured
- Iterative testing with fixture files to verify each pattern type
- Final integration testing to ensure all 4 test cases pass

## ✅ Previously Failing Tests (Now Fixed)
- ✅ `should parse use statements and imports` - All imports now properly detected including "Display", HashMap, wildcards, and aliases
- ✅ `should parse re-exports and pub use statements` - Pub use captures working with proper context flags
- ✅ `should capture extern crate and module declarations` - External crate declarations properly captured
- ✅ `should capture visibility modifiers` - All visibility modifiers detected and categorized

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

## ✅ Acceptance Criteria (All Completed)
- ✅ All use statements captured including grouped imports
- ✅ Import aliases properly detected and stored
- ✅ Pub use re-exports captured with `is_pub_use: true` and proper context flags
- ✅ Visibility modifiers detected and categorized (pub, pub(crate), pub(super), etc.)
- ✅ Extern crate declarations captured with and without aliases
- ✅ Module declarations properly identified with different visibility levels
- ✅ All 4 failing tests pass
- ✅ No regression in existing Rust parsing (all other tests continue to pass)

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

## Implementation Summary

This task has been **successfully completed** with all 4 failing tests now passing. The implementation provides comprehensive Rust module system support including:

- **Import Detection**: All forms of `use` statements including scoped imports, aliases, wildcards, and grouped imports
- **Re-export Tracking**: Proper detection of `pub use` statements with context flags for visibility and aliasing
- **Visibility System**: Complete support for Rust's visibility modifiers from plain `pub` to restricted `pub(in path::module)`
- **External Dependencies**: Detection of `extern crate` declarations both simple and aliased

The implementation required careful analysis of tree-sitter AST structures and iterative refinement of query patterns. Key technical challenges included understanding field-based vs direct child matching patterns and resolving configuration conflicts between capture patterns.

**Next Steps**: Integration with symbol resolution system for full cross-module call graph analysis capabilities (covered by follow-on tasks in the epic).