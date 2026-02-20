# MCP Tool Usage Guide

This guide shows when to use each MCP tool with real examples from refactoring sessions.

## Tool Overview

### 🔍 get_symbol_context
**REFACTORING HELPER**: Before changing any function/class, use this to see ALL its usages, dependencies, and relationships.

#### When to Use:
- **Before refactoring** - See all places a function/class is used
- **Understanding dependencies** - What does this function call? Who calls it?
- **Impact analysis** - Will my change break anything?
- **Debugging** - Why is this function being called unexpectedly?

#### Example Scenarios:
```bash
# Scenario: Migrating from class-based to functional architecture
mcp__ariadne-local__get_symbol_context("NamespaceImportResolver")
# Shows: All files using this class, methods called, inheritance

# Scenario: Understanding a complex function
mcp__ariadne-local__get_symbol_context("resolve_namespace_member")
# Shows: Every call site, what it calls, type information
```

### 📄 get_file_metadata
**FILE OVERVIEW**: When exploring unfamiliar code or planning changes to a file.

#### When to Use:
- **First time opening a file** - What's in here?
- **Planning refactoring** - What functions need to be migrated?
- **Finding specific functions** - Where is that helper defined?
- **Documentation** - List all exports from a module

#### Example Scenarios:
```bash
# Scenario: Understanding a module before refactoring
mcp__ariadne-local__get_file_metadata("src/import_resolution/namespace_imports.ts")
# Shows: All functions with signatures and line numbers

# Scenario: Finding test coverage gaps
mcp__ariadne-local__get_file_metadata("tests/namespace_imports.test.ts")
# Shows: What functions are tested
```

### 🎯 find_references
**IMPACT ANALYSIS**: Before renaming, removing, or changing function signatures.

#### When to Use:
- **Renaming** - Find every usage before renaming
- **Deletion** - Is it safe to delete this function?
- **Signature changes** - Who will be affected by parameter changes?
- **Understanding usage** - How is this function typically used?

#### Example Scenarios:
```bash
# Scenario: Removing deprecated function
mcp__ariadne-local__find_references("getNamespaceExports_DEPRECATED")
# Shows: All files still using the deprecated function

# Scenario: Changing function signature
mcp__ariadne-local__find_references("resolve_common_namespace_exports")
# Shows: Every call site that needs updating
```

### 📝 get_source_code
**CODE EXTRACTION**: When you need the EXACT implementation without surrounding code.

#### When to Use:
- **Copying implementations** - Extract clean code for reuse
- **Understanding logic** - See just the function without distractions
- **Comparing implementations** - How does Python vs JavaScript handle this?
- **Documentation** - Get the exact signature and docstring

#### Example Scenarios:
```bash
# Scenario: Extracting logic for migration
mcp__ariadne-local__get_source_code("resolveNamespaceExports")
# Returns: Just the function body for migration

# Scenario: Understanding complex logic
mcp__ariadne-local__get_source_code("find_reexported_namespaces")
# Returns: Implementation with comments
```

## Task-Based Usage Patterns

### Refactoring Class to Function
1. `get_symbol_context("ClassName")` - Find all usages
2. `get_file_metadata("path/to/class.ts")` - List all methods
3. `find_references("methodName")` - For each method
4. `get_source_code("methodName")` - Extract implementations

### Safe Function Deletion
1. `find_references("functionName")` - Check if used anywhere
2. `get_symbol_context("functionName")` - Check dependencies
3. If no references → Safe to delete

### Understanding New Codebase
1. `get_file_metadata("main/entry/file")` - Start with entry points
2. `get_symbol_context("mainFunction")` - Follow the call chain
3. `get_source_code("complexFunction")` - Deep dive into logic

### Adding Test Coverage
1. `get_file_metadata("src/module.ts")` - List all functions
2. `get_file_metadata("tests/module.test.ts")` - List tested functions
3. Compare to find gaps
4. `get_source_code("untestedFunction")` - Understand what to test

## Integration with Other Tools

- Use MCP tools for **analysis** before using Edit/Write tools for **changes**
- Use `find_references` before `grep` - it understands code structure
- Use `get_source_code` instead of `Read` when you need just one function
- Combine with `TodoWrite` to track refactoring tasks found via MCP tools

## Common Mistakes to Avoid

❌ Using `grep` to find function usages → Use `find_references` instead
❌ Using `Read` to understand a file → Start with `get_file_metadata`
❌ Changing functions without checking → Always use `get_symbol_context` first
❌ Manual search for implementations → Use `get_source_code` for exact extraction