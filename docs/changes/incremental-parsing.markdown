# Incremental Parsing Implementation

## Overview

RefScope now supports incremental parsing, a critical performance optimization that allows the parser to reuse unchanged portions of the AST when processing file edits. This feature is essential for real-time editing scenarios in IDEs and editors.

## Problem Statement

Previously, RefScope would re-parse the entire file from scratch on every update, regardless of the size or location of the change. This approach:
- Was inefficient for large files
- Created noticeable lag in editor integrations
- Wasted computational resources on unchanged code

## Solution

We implemented incremental parsing using tree-sitter's built-in edit tracking capabilities. The solution includes:

1. **Tree Caching**: Store parsed trees alongside source code
2. **Edit Tracking**: Track changes using tree-sitter's edit format
3. **Incremental Updates**: Reuse unchanged AST nodes during parsing

## Implementation Details

### Tree Caching

Added a `FileCache` interface to store parsed data:

```typescript
interface FileCache {
  tree: Tree;           // The parsed AST
  source_code: string;  // The current source code
  graph: ScopeGraph;    // The scope graph
}
```

### Edit Interface

Created an `Edit` interface compatible with tree-sitter:

```typescript
interface Edit {
  // Byte offsets
  start_byte: number;
  old_end_byte: number;
  new_end_byte: number;
  
  // Character positions
  start_position: Point;
  old_end_position: Point;
  new_end_position: Point;
}
```

### API Changes

Enhanced the `add_or_update_file` method to accept optional edit information:

```typescript
add_or_update_file(file_path: string, source_code: string, edit?: Edit)
```

Added a convenience method for range-based updates:

```typescript
update_file_range(
  file_path: string,
  start_position: Point,
  old_text: string,
  new_text: string
)
```

## Usage Examples

### Basic Incremental Update

```typescript
const project = new Project();

// Initial parse
project.add_or_update_file('example.ts', initialCode);

// Incremental update with edit information
const edit: Edit = {
  start_byte: 100,
  old_end_byte: 105,
  new_end_byte: 108,
  start_position: { row: 5, column: 10 },
  old_end_position: { row: 5, column: 15 },
  new_end_position: { row: 5, column: 18 }
};

project.add_or_update_file('example.ts', updatedCode, edit);
```

### Using the Convenience Method

```typescript
// Change 'const' to 'let' at a specific position
project.update_file_range(
  'example.ts',
  { row: 10, column: 0 },
  'const',
  'let'
);
```

## Performance Impact

Benchmark results show performance improvements for incremental parsing:

- **Small edits**: Typically faster than full reparse
- **Large files**: More pronounced benefits with larger files
- **Multiple edits**: Performance remains consistent due to tree reuse

Note: The actual performance benefit depends on various factors including file size, edit location, and system resources. In test environments, the benefit may be less pronounced due to overhead.

### Running Benchmarks

```bash
npm run benchmark
```

The benchmark script tests various file sizes (100, 500, and 1000 functions) and edit scenarios to measure the performance benefits of incremental parsing.

## Technical Architecture

### How It Works

1. **Edit Detection**: When an edit is provided, the system retrieves the cached tree
2. **Tree Update**: The cached tree is informed of the edit using `tree.edit()`
3. **Incremental Parse**: The parser reuses unchanged nodes from the old tree
4. **Graph Rebuild**: The scope graph is rebuilt (future optimization opportunity)

### Implementation Notes

- **Byte Offset Calculation**: The system correctly handles positions at the end of files by using `<=` in the loop condition
- **UTF-8 Support**: Byte offsets are calculated using `Buffer.from()` to handle multi-byte characters correctly
- **Parser Limitations**: Tree-sitter has a file size limit of approximately 32KB for parsing

### Tree-sitter Integration

Tree-sitter's incremental parsing works by:

- Maintaining byte and position information for each node
- Adjusting positions based on edits
- Reusing subtrees that haven't changed
- Only re-parsing affected regions

## Future Enhancements

1. **Incremental Scope Updates**: Only rebuild affected portions of the scope graph
2. **Batch Edits**: Support multiple edits in a single update
3. **Memory Optimization**: Implement cache eviction for large projects
4. **LSP Integration**: Direct integration with Language Server Protocol

## Migration Guide

Existing code continues to work without changes. To benefit from incremental parsing:

1. **For Simple Updates**: Use `update_file_range()` for convenience
2. **For Complex Edits**: Track edits and provide them to `add_or_update_file()`
3. **For Editors**: Integrate with your editor's change tracking system

## Testing

Comprehensive tests ensure correctness:

- Preservation of tree structure after edits
- Handling of various edit scenarios (insertions, deletions, replacements)
- Variable rename handling
- Adding new functions incrementally
- Multi-line code changes
- Edits at file boundaries (beginning and end of file)
- Cross-file reference integrity
- Performance regression tests

Run tests with:

```bash
npm test src/incremental.test.ts
```

## Conclusion

Incremental parsing makes RefScope suitable for real-time code intelligence in editors. The implementation balances performance gains with code simplicity, providing a solid foundation for future optimizations.
