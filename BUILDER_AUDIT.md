# Definition Builder Audit

## Overview
This document audits the definition_builder.ts and its usage across all language builders to identify missing functionality and gaps in implementation.

## Available Builder Methods

### Core Definition Methods
1. `add_class` - Add a class/struct definition
2. `add_method_to_class` - Add a method to a class
3. `add_function` - Add a function definition
4. `add_parameter_to_callable` - Add a parameter to function/method
5. `add_variable` - Add a variable or constant
6. `add_property_to_class` - Add a property/field to a class

### TypeScript-Specific Methods
7. `add_interface` - Add an interface definition
8. `add_method_signature_to_interface` - Add a method signature to interface
9. `add_property_signature_to_interface` - Add a property signature to interface
10. `add_type` - Add a TYPE ALIAS definition (NOT for classes/interfaces/enums!)
11. `add_enum` - Add an enum definition
12. `add_enum_member` - Add a member to an enum
13. `add_namespace` - Add a namespace definition
14. `add_decorator_to_target` - Add a decorator to class/method/property

### Import/Export Methods
15. `add_import` - Add an import definition

## Important: Types vs Type Aliases

**⚠️ IMPORTANT DISTINCTION:**

**Type ALIAS** (use `add_type`):
- Alternative name for a type expression
- TypeScript: `type Point = { x: number, y: number }`
- Rust: `type Kilometers = i32`
- Python: `Point: TypeAlias = tuple[int, int]`

**Type DEFINITION** (use dedicated methods):
- Classes: `add_class` - creates new nominal type
- Interfaces: `add_interface` - creates type contract
- Enums: `add_enum` - creates enumerated type

**Why separate?**
- Different structures (classes have methods/properties, aliases just have expressions)
- Different semantics (classes are nominal/identity-based, aliases are transparent)
- Different query needs (find classes vs find types)

**Key Point:** Classes, interfaces, and enums ARE types, but they're not type ALIASES. Don't call `add_type` when adding a class/interface/enum!

See [TYPE_SYSTEM_ANALYSIS.md](TYPE_SYSTEM_ANALYSIS.md) for detailed explanation.

## Language Builder Usage Matrix

| Builder Method | JavaScript | TypeScript | Python | Rust | Notes |
|---------------|------------|------------|--------|------|-------|
| **add_class** | ✅ | ✅ | ✅ | ✅ | Rust uses for structs |
| **add_method_to_class** | ✅ | ✅ | ✅ | ✅ | All languages use |
| **add_function** | ✅ | ✅ (inherited) | ✅ | ✅ | All languages use |
| **add_parameter_to_callable** | ✅ | ✅ (inherited) | ✅ | ❌ | **Rust missing!** |
| **add_variable** | ✅ | ✅ (inherited) | ✅ | ✅ | All languages use |
| **add_property_to_class** | ✅ | ✅ | ✅ | ✅ | Rust uses for fields |
| **add_interface** | ❌ | ✅ | ❌ | ✅ | Rust uses for traits |
| **add_method_signature_to_interface** | ❌ | ✅ | ❌ | ❌ | **Rust traits missing!** |
| **add_property_signature_to_interface** | ❌ | ✅ | ❌ | ❌ | Not needed for Rust |
| **add_type** | ❌ | ✅ | ⚠️ | ✅ | Type aliases; Python support being added (task 11.108.4) |
| **add_enum** | ❌ | ✅ | ❌ | ✅ | Enums |
| **add_enum_member** | ❌ | ✅ | ❌ | ✅ | Enum variants |
| **add_namespace** | ❌ | ✅ | ❌ | ✅ | Rust uses for modules |
| **add_decorator_to_target** | ❌ | ✅ | ❌ | ❌ | **Python missing!** |
| **add_import** | ✅ | ✅ (inherited) | ✅ | ❌ | **Rust missing!** |

## Critical Issues Found

### 1. ❌ Missing Constructor Support
**Problem**: The builder has NO dedicated `add_constructor` method!
- Current workaround: Constructors are added as methods with special naming
- JavaScript: Adds "constructor" method to class
- Python: Adds "__init__" or "constructor" method to class
- Rust: Adds "new" as static method with "constructor" name
- TypeScript: Same as JavaScript

**Impact**:
- Constructors are stored as methods, not in the dedicated `constructor` field
- The `ConstructorBuilderState` exists but is never used
- Constructor parameters can't be tracked separately from method parameters

**Required**: Add `add_constructor_to_class` method

### 2. ❌ Rust Missing Parameter Tracking
**Problem**: Rust builder doesn't call `add_parameter_to_callable` at all!
- Line 506-508: `["definition.parameter", { process: () => {} }]` - Empty implementation!
- Functions and methods have NO parameters tracked

**Impact**:
- Function signatures are incomplete
- Method signatures lack parameter information
- Type information for parameters is lost

**Required**: Implement parameter tracking in Rust builder

### 3. ❌ Rust Missing Import Tracking
**Problem**: Rust builder doesn't track imports
- No `add_import` calls anywhere
- `use` statements are not captured

**Impact**:
- Cross-file resolution impossible
- Can't track external dependencies
- Module system not represented

**Required**: Add import tracking to Rust builder

### 4. ❌ Rust Trait Methods Missing
**Problem**: Rust traits (mapped to interfaces) don't add method signatures
- Traits are created with `add_interface`
- But trait methods are never added to the interface
- Line 398-408: Method in trait tries `add_method_to_class` on trait_id

**Impact**:
- Trait method signatures are lost
- Interface contracts incomplete

**Required**: Add `add_method_signature_to_interface` calls for trait methods

### 5. ❌ Python Decorators Not Applied
**Problem**: Python extracts decorators but never calls `add_decorator_to_target`
- `extract_decorators()` helper exists (line 173-193)
- Decorators are extracted but discarded
- No decorator tracking for classes, methods, or properties

**Impact**:
- Decorator information is lost
- Can't track @property, @staticmethod, @classmethod metadata
- Semantic analysis incomplete

**Required**: Add `add_decorator_to_target` calls in Python builder

### 6. ❌ TypeScript Interface Method Parameters
**Problem**: Interface methods don't track parameters properly
- `add_method_signature_to_interface` is called (line 715)
- But parameters for interface methods are never added
- No capture for interface method parameters in the query

**Impact**:
- Interface method signatures incomplete
- Type checking information missing

**Required**: Add parameter tracking for interface methods

## Builder Method Gaps

### Missing: `add_constructor_to_class`
**Signature needed**:
```typescript
add_constructor_to_class(
  class_id: SymbolId,
  definition: {
    symbol_id: SymbolId;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
    // parameters handled separately
  }
): DefinitionBuilder
```

**Why**: Constructors should be separate from methods, using the dedicated `constructor` field

### Missing: `add_parameter_to_constructor`
**Status**: Could use existing `add_parameter_to_callable`
**Issue**: Need to find constructor by ID, not just methods/functions

### Missing: `add_parameter_to_interface_method`
**Status**: Could use existing `add_parameter_to_callable`
**Issue**: Need to support interface method IDs

## Implementation Notes

### Constructor Handling
The builder has infrastructure for constructors but no API:
- `ConstructorBuilderState` interface exists (line 91-95)
- `constructor?: ConstructorBuilderState` field in `ClassBuilderState` (line 75)
- `build_constructor` private method exists (line 685-696)
- But NO public method to add constructor!

Current workaround treats constructors as special methods, which works but:
- Doesn't use the dedicated state
- Mixes constructor params with method params
- Makes it harder to distinguish constructors from methods

### Parameter Tracking Implementation
The `add_parameter_to_callable` method (line 312-347) searches:
1. Functions map
2. Methods within classes
3. Falls through silently if not found

Missing:
- Constructors (if we add dedicated support)
- Interface methods
- Rust: ALL callables

## Recommendations

### Immediate Fixes (High Priority)
1. ✅ Add `add_constructor_to_class` method
2. ✅ Update `add_parameter_to_callable` to support constructors
3. ✅ Fix Rust parameter tracking (non-empty implementation)
4. ✅ Fix Rust import tracking
5. ✅ Fix Python decorator tracking

### Medium Priority
1. ✅ Add Rust trait method signatures to interfaces
2. ✅ Add TypeScript interface method parameter tracking
3. ✅ Consider: Should we add parameters to interface methods?

### Low Priority
1. Review orphan tracking (lines 167-176) - is it being used?
2. Consider: Generic parameter tracking beyond string[]
3. Consider: Return type tracking as separate entities

## Nested Object Tracking Status

### ✅ Working
- **Methods in Classes**: All languages properly add methods to classes
- **Properties in Classes**: All languages properly add properties/fields to classes
- **Parameters in Functions**: JS, TS, Python ✅ (Rust ❌)
- **Parameters in Methods**: JS, TS, Python ✅ (Rust ❌)
- **Enum Members**: TS, Rust ✅
- **Interface Properties**: TS ✅
- **Interface Methods**: TS ✅

### ❌ Not Working
- **Constructors as dedicated objects**: None (all use method workaround)
- **Parameters in Constructors**: Indirect via method params
- **Parameters in Rust**: Not tracked at all
- **Parameters in Interface Methods**: Not tracked (TS)
- **Trait Method Signatures**: Not added to interface (Rust)

## Summary

The definition_builder has good coverage for basic definitions but critical gaps in:
1. **Constructor Support**: No dedicated API, using method workaround
2. **Rust Implementation**: Missing parameters and imports entirely
3. **Nested Objects**: Parameters not tracked for constructors, interface methods, or Rust
4. **Decorators**: Python extracts but doesn't apply

These gaps prevent complete semantic analysis and cross-file resolution for affected languages.
