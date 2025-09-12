# Task 11.100.0.5.21: Symbol Refactor - Core Type Maps

## Parent Task
11.100.0.5 - Review and Refine Types for Tree-sitter Query System

## Overview
Replace Map keys from individual name types to universal SymbolId in core type definitions. This is the foundation for the symbol system migration.

## Priority
**🔥 CRITICAL** - Foundation for all symbol refactoring

## Scope

### Already Identified
- packages/types/src/types.ts - TypeDefinition maps
- packages/types/src/classes.ts - Method/Property maps  
- packages/core/src/type_analysis/type_registry/type_registry.ts
- packages/core/src/inheritance/class_hierarchy/class_hierarchy.ts

### Additionally Found
- packages/core/src/scope_analysis/scope_tree/scope_tree.ts
  - Line 599: `Map<string, ScopeSymbol>` → `Map<SymbolId, ScopeSymbol>`
- packages/core/src/scope_analysis/scope_tree/enhanced_symbols.ts
  - Line 28: `Map<string, EnhancedScopeSymbol>` → `Map<SymbolId, EnhancedScopeSymbol>`

## Implementation Checklist

### Core Type Maps
- [ ] types.ts Line 31: `ReadonlyMap<PropertyName | MethodName, TypeMember>`
- [ ] types.ts Line 61: `ReadonlyMap<TypeName, TypeDefinition>`
- [ ] types.ts Line 66: `ReadonlyMap<TypeName, TypeDefinition>`
- [ ] classes.ts Line 35: `ReadonlyMap<MethodName, MethodNode>`
- [ ] classes.ts Line 36: `ReadonlyMap<PropertyName, PropertyNode>`

### Registry Maps
- [ ] type_registry.ts Line 32: `ReadonlyMap<TypeName, QualifiedName>`
- [ ] type_registry.ts Lines 449-454: Internal Maps

### Hierarchy Maps
- [ ] class_hierarchy.ts Line 108: `Map<QualifiedName, ClassNode>`
- [ ] class_hierarchy.ts Lines 542-543: Method maps
- [ ] class_hierarchy.ts Lines 566-567: Property maps

### Scope Maps (NEW)
- [ ] scope_tree.ts Line 599: Symbol storage maps
- [ ] enhanced_symbols.ts Line 28: Enhanced symbol maps

## Success Criteria
- All identified Maps use SymbolId keys
- No regression in functionality
- Tests pass

## Dependencies
- Requires: symbol_utils.ts (✅ completed)
- Blocks: All other symbol refactor tasks

## Estimated Time
2-3 days