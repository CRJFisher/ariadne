# Type Consolidation Migration Plan - Task 11.75

## Analysis Summary

### Type Comparison Results

#### 1. FunctionInfo vs FunctionDefinition
**Decision: Keep FunctionInfo as primary**

Current FunctionInfo structure:
- Uses FunctionSignature for parameters/return type
- Has metadata, docstring, decorators

Missing from FunctionInfo (in FunctionDefinition):
- `is_exported: boolean`
- `is_arrow_function?: boolean` 
- `is_anonymous?: boolean`
- `closure_captures?: readonly string[]`
- Direct access to `generics` (currently in FunctionSignature.type_parameters)

#### 2. ClassInfo vs ClassDefinition  
**Decision: Keep ClassDefinition as primary**

ClassDefinition advantages:
- More complete metadata (is_final, is_interface, is_trait, is_mixin)
- Has generics support
- Extends Definition base interface
- Uses "extends" instead of "base_classes" (more standard)

#### 3. MethodInfo vs MethodDefinition
**Decision: Keep MethodDefinition as primary**

MethodDefinition advantages:
- More complete override tracking (overrides, overridden_by)
- Has is_constructor, is_async fields
- Flat structure (no FunctionSignature indirection)

#### 4. PropertyInfo vs PropertyDefinition
**Decision: Keep PropertyDefinition as primary**

PropertyDefinition advantages:
- Has decorators support
- Uses "initial_value" (clearer than "default_value")
- More consistent with other Definition types

## Migration Strategy

### Phase 1: Enhance FunctionInfo
Since FunctionInfo is widely used but missing fields, we'll enhance it first:
1. Add missing fields to FunctionInfo
2. Keep FunctionSignature structure for backward compatibility
3. Add helper accessors if needed

### Phase 2: Create Type Aliases
```typescript
// In common.ts - temporary aliases for smooth migration
export type ClassInfo = ClassDefinition; 
export type MethodInfo = MethodDefinition;
export type PropertyInfo = PropertyDefinition;
```

### Phase 3: Update Imports Systematically

Order of updates (least to most complex):
1. **PropertyInfo → PropertyDefinition** (17 files)
2. **MethodInfo → MethodDefinition** (10 files)  
3. **ClassInfo → ClassDefinition** (39 files)
4. **Enhance FunctionInfo** (keep name, add fields)

### Phase 4: Delete type_converters.ts
This file contains conversion functions between Info and Definition types.
Once types are consolidated, this entire file becomes unnecessary.

### Phase 5: Cleanup
1. Remove type aliases
2. Remove old type definitions
3. Update all documentation

## File Update Order

### Critical Path Files
1. `packages/types/src/common.ts` - Add aliases, enhance FunctionInfo
2. `packages/types/src/definitions.ts` - Keep as primary source
3. `packages/core/src/utils/type_converters.ts` - DELETE entirely

### High Impact Files (Update Early)
1. `packages/core/src/code_graph.ts` - Heavy user of all types
2. `packages/core/src/file_analyzer.ts` - Entry point for analysis
3. `packages/core/src/inheritance/class_hierarchy/` - Uses ClassInfo heavily

### Module Groups (Update Together)
1. **Type Registry modules** - All use ClassDefinition already
2. **Scope Analysis modules** - Mix of Info and Definition types
3. **Inheritance modules** - Heavy ClassInfo users

## Risk Mitigation

1. **Type Aliases First** - Prevents breaking changes during migration
2. **Incremental Updates** - Update one type at a time
3. **Type Checking** - Run `npm run typecheck` after each phase
4. **Test Coverage** - Run tests after each module group update

## Success Metrics

- [ ] No type errors after migration
- [ ] All tests pass
- [ ] type_converters.ts deleted
- [ ] Single definition for each entity type
- [ ] No performance regression