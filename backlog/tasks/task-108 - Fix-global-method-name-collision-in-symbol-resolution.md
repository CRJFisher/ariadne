---
id: task-108
title: Fix global method name collision in symbol resolution
status: To Do
assignee: []
created_date: '2025-08-19'
labels:
  - bug
  - symbol-resolution
dependencies: []
---

## Description

Methods with common names (like "new", "init", "toString") are treated as global symbols rather than being scoped to their class/struct. This causes collisions where searching for "new" returns ALL methods named "new" across all classes/structs in the project.

## Problem

When using MCP tools (or the underlying Ariadne API), method names are resolved globally instead of being scoped to their parent class/struct. This is particularly problematic in Rust where `new()` is a common convention for constructors.

### Failing Example

Given these Rust files:

```rust
// test_collision.rs
pub struct Foo {
    value: i32,
}

impl Foo {
    pub fn new() -> Self {
        Foo { value: 42 }
    }
}

pub struct Bar {
    name: String,
}

impl Bar {
    pub fn new() -> Self {
        Bar { name: String::from("bar") }
    }
}

// Standalone new function
pub fn new() -> bool {
    true
}
```

When calling `find_references(symbol: "new")`, it returns:
- `Foo::new()` at line 6
- `Bar::new()` at line 16  
- Standalone `new()` at line 22
- Plus any other `new()` methods in other files

When calling `get_source_code(symbol: "new")`, it returns whichever one it finds first, with no way to specify which one you want.

Attempting to use scoped names like `get_source_code(symbol: "Foo::new")` returns "symbol_not_found".

## Acceptance Criteria

- [ ] Methods are properly scoped to their parent class/struct
- [ ] Searching for a bare method name only finds standalone functions with that name
- [ ] Support for qualified names like `ClassName::method_name` or `ClassName.method_name`
- [ ] MCP tools can distinguish between methods of the same name in different classes
- [ ] Tests verify the fix works for all supported languages

## Proposed Solution

Options to consider:
1. Store methods with qualified symbol IDs (e.g., `Foo::new` instead of just `new`)
2. Add a parent/scope field to symbol definitions to track containment
3. Support both bare and qualified name searches, with bare names being scoped appropriately
4. For MCP tools specifically, could accept an optional "parent" or "scope" parameter

## Impact

This affects:
- MCP tools: `get_symbol_context`, `get_source_code`, `find_references`
- Core Ariadne APIs that resolve symbols
- Any tools or IDEs that depend on symbol resolution

## Test Cases

1. Multiple classes with same method name in same file
2. Multiple classes with same method name across files
3. Standalone function with same name as methods
4. Nested classes/modules with duplicate method names
5. Language-specific patterns (Rust impl blocks, Python class methods, etc.)