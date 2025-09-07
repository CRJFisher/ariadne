# Export Detection Bespoke Logic Justification

This document explains why certain export detection logic must remain in bespoke handlers rather than being moved to the generic processor.

## Overview

The export detection module follows a configuration-driven pattern where ~85% of logic is handled by the generic processor and ~15% requires language-specific bespoke handlers. After thorough analysis, all current bespoke logic is justified and necessary.

## JavaScript Bespoke Handler (193 lines)

### CommonJS Object Exports
**Pattern**: `module.exports = { foo, bar }`
**Why Bespoke**: Requires parsing JavaScript object literals to extract individual export names. The structure and syntax of object literals is JavaScript-specific and would require a full JS expression parser to generalize.

### Complex Default Re-exports
**Pattern**: `export { default as MyName } from './module'`
**Why Bespoke**: The semantics of default exports in ES6 modules requires special handling to distinguish between default and named exports in re-export contexts.

### Dynamic Computed Property Exports
**Pattern**: `exports[dynamicKey] = value`
**Why Bespoke**: Runtime-dependent exports using computed property names cannot be statically analyzed without JavaScript-specific expression evaluation.

## TypeScript Bespoke Handler (357 lines)

### Type-Only Exports
**Pattern**: `export type { MyType } from './types'`
**Why Bespoke**: TypeScript-specific syntax that distinguishes between type and value exports. This distinction doesn't exist in other languages and is critical for proper TypeScript module resolution.

### Namespace Exports
**Pattern**: `export namespace Utils { ... }`
**Why Bespoke**: TypeScript namespaces have complex nested structures. Due to tree-sitter AST limitations for TypeScript, text-based pattern matching is required to detect these properly.

### Declaration Merging
**Pattern**: Multiple declarations with same name that merge
**Why Bespoke**: Unique TypeScript feature where interfaces, classes, and namespaces with the same name merge into a single exported entity. No other language has this concept.

## Python Bespoke Handler (289 lines)

### __all__ List Exports
**Pattern**: `__all__ = ['foo', 'bar']`
**Why Bespoke**: Python-specific mechanism for defining module exports. Requires parsing Python list literals and string values, which is unique to Python's module system.

### Conditional Exports
**Pattern**: Exports inside `if` statements
**Why Bespoke**: Python's `if __name__ == '__main__'` idiom requires special handling to exclude main-block code from exports. This runtime conditional export pattern is Python-specific.

### Star Import Re-exports
**Pattern**: `from module import *`
**Why Bespoke**: Python's star import mechanism interacts with `__all__` in complex ways that require Python-specific understanding of module resolution.

### Decorator-Based Exports
**Pattern**: `@export` decorator
**Why Bespoke**: Python decorators are a language-specific feature that modifies function/class behavior at definition time.

## Rust Bespoke Handler (510 lines)

### Complex Visibility Modifiers
**Pattern**: `pub(crate)`, `pub(super)`, `pub(in path)`
**Why Bespoke**: Rust's visibility system is uniquely complex with scoped visibility that doesn't exist in other languages. Each modifier has different semantic meaning for export scope.

### Use Tree Parsing
**Pattern**: `pub use crate::module::{Item1, Item2 as Alias}`
**Why Bespoke**: Rust's use declarations have complex nested structures with lists, aliases, and glob patterns. The tree structure requires ~100 lines of specialized parsing logic.

### Macro Exports
**Pattern**: `#[macro_export]`
**Why Bespoke**: Rust's attribute-based macro export system is unique. Macros have different scoping rules than regular items.

### Trait Implementations
**Pattern**: `impl Trait for Type { pub fn method() {} }`
**Why Bespoke**: Rust's trait system with impl blocks containing public methods requires understanding Rust's type system and trait coherence rules.

### Module Nesting
**Pattern**: `pub mod outer { pub mod inner { ... } }`
**Why Bespoke**: Rust's module system with inline and file-based modules has complex path resolution that differs from other languages.

## Conclusion

Each bespoke handler addresses genuinely language-specific patterns that would be impractical or impossible to generalize without building language-specific parsers into the generic processor. The current split achieves a good balance between:

1. **Generic handling** of common patterns (export statements, simple visibility, specifiers)
2. **Bespoke handling** of language-specific idioms and complex syntax

The bespoke handlers are well-justified and should remain separate to maintain clarity and correctness for each language's unique export mechanisms.