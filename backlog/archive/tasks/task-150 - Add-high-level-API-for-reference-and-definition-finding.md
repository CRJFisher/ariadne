# Task 150: Add High-Level API for Reference and Definition Finding

## Status
Pending

## Description
Create a user-friendly high-level API for finding references and definitions based on simple inputs like symbol names and cursor positions. This will wrap the existing low-level usage_finder functionality with an intuitive interface.

## Context
Currently, the usage_finder module provides powerful symbol tracking but requires complex inputs:
- ScopeTree
- Language
- FilePath  
- SyntaxNode
- SourceCode

Users need a simpler interface that accepts just a symbol name or position and handles the complexity internally.

## Requirements

### Core API Methods

1. **FileAnalysis Level (Single File)**
   ```typescript
   interface FileAnalysis {
     // Find all references to a symbol by name
     findReferences(symbolName: string): Reference[];
     
     // Find references at a specific position (IDE-style)
     findReferencesAt(line: number, column: number): Reference[];
     
     // Find the definition of a symbol
     findDefinition(symbolName: string): Definition | null;
     
     // Find definition at cursor position
     findDefinitionAt(line: number, column: number): Definition | null;
     
     // Get usage statistics for a symbol
     getUsageStats(symbolName: string): UsageStatistics;
   }
   ```

2. **CodeGraph Level (Cross-File)**
   ```typescript
   interface CodeGraph {
     // Find all references across all files
     findReferencesAcrossFiles(symbolName: string): Map<FilePath, Reference[]>;
     
     // Find definition across all files
     findDefinitionAcrossFiles(symbolName: string): Definition | null;
     
     // Find all usages of a definition
     findUsages(definition: Definition): Usage[];
     
     // Find unused symbols across the project
     findUnusedSymbols(): Symbol[];
   }
   ```

### Reference and Definition Types
```typescript
interface Reference {
  location: Location;
  usage_type: 'read' | 'write' | 'call' | 'import' | 'export' | 'type';
  context: string; // Snippet of code around the reference
}

interface Definition {
  symbol_name: string;
  location: Location;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface';
  scope: string;
}

interface UsageStatistics {
  total_references: number;
  by_type: Record<Usage['usage_type'], number>;
  by_file: Map<FilePath, number>;
}
```

## Implementation Plan

### Phase 1: Type Definitions
1. Add new types to `packages/types/src/references.ts`
2. Extend FileAnalysis interface with optional reference methods
3. Extend CodeGraph interface with cross-file methods

### Phase 2: Context Management
1. Create a ReferenceContext class to manage state
2. Cache parsed ASTs and scope trees
3. Implement efficient symbol lookup

### Phase 3: API Implementation
1. Implement FileAnalysis-level methods
2. Add cross-file resolution in CodeGraph
3. Handle edge cases (ambiguous symbols, overloads)

### Phase 4: Performance Optimization
1. Add caching for frequently accessed symbols
2. Implement lazy loading for large files
3. Create index structures for fast lookup

### Phase 5: Testing and Documentation
1. Unit tests for each API method
2. Integration tests with real codebases
3. API documentation and examples

## Acceptance Criteria
- [ ] Simple string-based symbol lookup works
- [ ] Position-based lookup works (line/column)
- [ ] Cross-file references are found correctly
- [ ] Performance is acceptable for large files (< 100ms for typical queries)
- [ ] API is intuitive and well-documented
- [ ] Backward compatibility maintained

## Dependencies
- usage_finder module must be fully integrated
- FileAnalysis type must be extended
- CodeGraph must support reference tracking

## Estimated Effort
- Type definitions: 2 hours
- Implementation: 8 hours
- Testing: 4 hours
- Documentation: 2 hours

Total: ~16 hours

## Related Tasks
- Task 11.74.20: Wire usage finder module (completed)
- Integration of usage_finder into file_analyzer.ts (pending)
