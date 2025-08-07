---
id: task-60
title: Handle tree-sitter 32KB file size limitation
status: To Do
assignee: []
created_date: '2025-08-01'
updated_date: '2025-08-01'
labels: []
dependencies: []
---

## Description

Tree-sitter has a hard 32KB limit on file sizes it can parse. We submitted an [issue](https://github.com/tree-sitter/node-tree-sitter/issues/250) but received no response after 2 weeks.

The project has low activity (200 stars), suggesting limited maintainer engagement. We need a solution to parse large files that exceed this limit.

The current approach ignores content after 32KB, but this loses important code analysis data.

## Acceptance Criteria

- [ ] Large files (>32KB) are fully parsed without data loss
- [ ] Solution maintains accurate scope and symbol resolution
- [ ] Performance impact is acceptable for large files
- [ ] Solution works across all supported languages
- [ ] Integration is transparent to existing code analysis features
- [ ] Fallback mechanism exists if parsing fails

## Implementation Plan

### Evaluation: Intelligent Chunking Challenges

The intelligent chunking approach has significant challenges:

1. **SYNTAX BOUNDARY ISSUES**: Splitting files risks breaking at syntax boundaries (mid-function, mid-class)
2. **SCOPE RECONSTRUCTION**: Unlike multi-file imports with clear boundaries, chunks would need manual scope stitching
3. **SYMBOL RESOLUTION**: Variables/functions declared in one chunk may be referenced in another
4. **AST INTEGRITY**: Tree-sitter expects complete, valid syntax trees - partial trees may fail or produce incorrect results

### Alternative Approaches to Consider

1. **CALLBACK-BASED PARSING API**: Tree-sitter offers a callback-based parsing API designed for non-string data structures:

   ```javascript
   parser.parse((index, position) => {
     // Return text starting at the given position
     // e.g., for line-based storage: return lines[position.row].slice(position.column)
   });
   ```

   Purpose: Allows parsing from ropes, piece tables, or other text editor data structures.
   
   We mentioned this in our issue, but it's not actually a solution - it just changes how you provide input to the parser. The 32KB limit likely still applies since it's an internal buffer limitation, not an input method limitation.

2. **SYNTAX-AWARE SPLITTING**: Parse file structure first to find natural boundaries (top-level functions/classes)
3. **OVERLAPPING CHUNKS**: Parse with overlap to maintain context across boundaries
4. **HYBRID APPROACH**: Use tree-sitter for <32KB files, fallback to regex/pattern matching for larger files
5. **UPSTREAM FIX**: Fork tree-sitter-node and remove/increase the limit
6. **WASM ALTERNATIVE**: Use tree-sitter WASM bindings which may not have this limitation

### Recommended Approach

Start with syntax-aware splitting at top-level declarations, as this maintains semantic integrity while working within the constraint.

### Detailed Analysis: Syntax-Aware Splitting

#### Overview

Syntax-aware splitting involves pre-parsing files to identify natural syntactic boundaries where we can safely split the code without breaking language constructs. This approach requires language-specific knowledge but offers the best balance between accuracy and feasibility.

#### Implementation Strategy

1. **First-Pass Lightweight Parsing**
   - Use regex or simple pattern matching to identify top-level declarations
   - This parsing doesn't need to be perfect, just good enough to find split points
   - Can leverage existing language configurations in our codebase

2. **Language-Specific Split Points**

   ```txt
   JavaScript/TypeScript:
   - Between top-level function declarations
   - Between class declarations
   - Between export statements
   - After import blocks

   Python:
   - Between top-level function/class definitions
   - After import statements
   - Between module-level variable assignments

   Java/C#:
   - Between class declarations
   - Between namespace/package blocks
   - After import/using statements

   Go:
   - Between top-level function declarations
   - Between type definitions
   - After import blocks
   ```

3. **Chunk Construction Algorithm**

   ```txt
   1. Identify all potential split points using language-specific patterns
   2. Group declarations to stay under 32KB limit
   3. Ensure each chunk includes necessary context (imports, type definitions)
   4. Add synthetic markers to track chunk boundaries for later reassembly
   ```

#### Challenges and Solutions

##### Challenge 1: Language Variety

- **Problem**: Need patterns for each supported language
- **Solution**: Leverage existing LanguageConfiguration system, add `splitPatterns` property
- **Fallback**: For unsupported languages, fall back to line-based splitting at 30KB

##### Challenge 2: Cross-Chunk References

- **Problem**: A function in chunk 2 might reference a type from chunk 1
- **Solution**:
  - Parse chunks with overlapping context (include previous chunk's declarations as "ghost" nodes)
  - Build a symbol table during first pass to track cross-chunk dependencies

##### Challenge 3: Maintaining Parse Context

- **Problem**: Parser state (like nested scopes) lost between chunks
- **Solution**:
  - Inject synthetic scope markers at chunk boundaries
  - Reconstruct scope hierarchy during reassembly phase

#### Example Implementation Approach

```ts
interface ChunkStrategy {
  findSplitPoints(content: string): number[];
  createChunks(content: string, splitPoints: number[]): Chunk[];
  reassembleAST(chunks: ParsedChunk[]): CompleteAST;
}

interface LanguageChunkStrategy extends ChunkStrategy {
  // Language-specific patterns for identifying safe split points
  topLevelPatterns: RegExp[];
  // Minimum context needed (e.g., imports)
  contextPatterns: RegExp[];
}
```

#### Advantages

- Maintains syntactic integrity
- Preserves most semantic relationships
- Can leverage existing language configurations
- Graceful degradation for unsupported languages

#### Disadvantages

- Requires language-specific implementation
- Complex reassembly logic
- May still miss some cross-chunk relationships
- Additional parsing overhead

#### Alternative: Simplified Approach

If full syntax-aware splitting proves too complex, consider:

1. **Line-count based splitting** with heuristics (avoid splitting inside string literals, comments)
2. **Two-phase parsing**: First phase gets structure, second phase gets details
3. **Streaming parser**: Modify tree-sitter to handle streams instead of full buffers
