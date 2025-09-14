# Task 11.100.0.5.32: Delete Old Types from Modules

## Status
Status: Not Started
Priority: High
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary

Delete all old type definitions that were internal to AST processing modules and remove any remaining legacy types from the types package. This completes the transition to the new unified type system.

## Types to Delete

### From AST Processing Modules

1. **Local Type Definitions**
   - Internal interfaces in AST processing files
   - Helper type definitions for node processing
   - Language-specific type variants
   - Intermediate processing types

2. **Examples of Old Types to Remove**
   ```typescript
   // From function_calls.ts
   interface FunctionCallNode {
     name: string;
     arguments: ArgumentNode[];
   }
   
   // From class_detection.ts  
   interface ClassNode {
     className: string;
     methods: MethodNode[];
   }
   
   // From import_resolution.ts
   interface ImportNode {
     source: string;
     specifiers: ImportSpecifier[];
   }
   ```

### From Types Package

1. **Legacy Interfaces**
   - Old call types (if not already removed)
   - Old symbol types (non-SymbolId based)
   - Processing-specific types
   - Adapter types

2. **Deprecated Type Unions**
   - Remove unions that included deleted types
   - Simplify type hierarchies

## Implementation Steps

1. **Survey Internal Types**
   - Scan each AST module for local type definitions
   - Identify which are still needed for stubs
   - Mark the rest for deletion

2. **Clean AST Modules**
   - Remove internal type definitions
   - Keep only imported types from @ariadnejs/types
   - Ensure stubs use unified types

3. **Clean Types Package**
   - Remove types that were only used by deleted code
   - Ensure all remaining types follow SymbolId pattern
   - Update exports to remove deleted types

4. **Update Imports**
   - Fix any broken imports
   - Ensure modules import from @ariadnejs/types

## Types to Keep

### Essential Types
- Core types used by `generate_code_graph`
- Types used by enhancement modules
- SymbolId and related types
- FileAnalysis and its components

### Stub Return Types
Keep minimal types needed for stub functions:
```typescript
// These unified types stay
import { 
  FunctionCall,
  MethodCall, 
  ClassDefinition,
  Import,
  Export
} from '@ariadnejs/types';
```

## Success Criteria

- No internal type definitions in AST modules
- Types package contains only unified types
- All remaining types use SymbolId pattern
- No compilation errors
- Significant reduction in type complexity

## Dependencies

- Task 27: Stub modules implemented
- Task 29: Language-specific files removed
- Task 31: Helper functions deleted

## Follow-up Tasks

- Task 33: Survey SymbolId usage universally