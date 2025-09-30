# Capture Name Mapping Guide

## Overview

This guide provides systematic mappings from invalid capture names to valid `@category.entity` patterns, preserving additional qualifiers for context.

## Mapping Rules

### General Principles

1. **Category must be valid SemanticCategory**: `scope`, `definition`, `reference`, `import`, `export`, `type`, `assignment`, `return`, `decorator`, `modifier`

2. **Entity must be valid SemanticEntity**: See full list in `scope_processor.ts`

3. **Additional qualifiers preserve context**: `@category.entity.additional.parts.as.needed`

4. **Language configs match full string**: The config looks for exact matches like `"definition.parameter.optional"`

## Common Invalid → Valid Mappings

### Definition Entity Mappings
```
@definition.param → @definition.parameter
@definition.param.X → @definition.parameter.X
@definition.loop_var → @definition.variable.loop
@definition.comprehension_var → @definition.variable.comprehension
@definition.except_var → @definition.variable.exception
@definition.with_var → @definition.variable.context
@definition.catch_param → @definition.parameter.exception
@definition.arrow → @definition.function.arrow
@definition.lambda → @definition.function.lambda
```

### Reference Entity Mappings
```
@reference.identifier → @reference.variable (or context-specific)
@reference.receiver → @reference.variable.receiver
@reference.object → @reference.variable.object
@reference.method_call → @reference.call.method
@reference.chain → @reference.member_access.chain
@reference.assign.target → @reference.variable.assignment_target
@reference.assign.source → @reference.variable.assignment_source
@reference.update → @reference.variable.update
@reference.jsx → @reference.call.jsx (JSX elements are function calls)
@reference.ref → @reference.variable
@reference.return → @return.variable (or @return.function)
```

### Assignment Entity Mappings
```
@assignment.expr → @assignment.variable
@assignment.member → @assignment.property
@assignment.var → @assignment.variable
@assignment.target → @assignment.variable.target (internal use)
@assignment.source → @assignment.variable.source (internal use)
```

### Scope Entity Mappings
```
@scope.lambda → @scope.closure
@scope.for → @scope.block.for
@scope.while → @scope.block.while
@scope.with → @scope.block.with
@scope.if → @scope.block.if
@scope.elif → @scope.block.elif
@scope.else → @scope.block.else
@scope.try → @scope.block.try
@scope.except → @scope.block.except
@scope.finally → @scope.block.finally
@scope.match → @scope.block.match
@scope.case → @scope.block.case
@scope.comprehension → @scope.block.comprehension
```

### Type Entity Mappings
```
@type.annotation → @type.type_annotation
@type.constraint → @type.type_constraint
@type.alias → @type.type_alias
```

### Category Corrections
```
@call.X → @reference.call.X
```

## Language-Specific Mappings

### Rust-Specific

#### Scope Mappings
```
@scope.struct → @scope.class.struct
@scope.trait → @scope.interface.trait
@scope.impl → @scope.block.impl
@scope.loop → @scope.block.loop
@scope.match_arm → @scope.block.match_arm
```

#### Definition Mappings
```
@definition.struct → @definition.class.struct
@definition.trait → @definition.interface.trait
@definition.enum_variant → @definition.enum_member.variant
@definition.trait_method → @definition.method.trait
@definition.associated_type → @definition.type_alias.associated
@definition.associated_const → @definition.constant.associated
@definition.const_param → @definition.parameter.const
```

#### Pattern Mappings (Rust pattern matching)
```
@pattern.X → @reference.variable.pattern_X
@pattern.definition → @definition.variable.pattern
```

#### Ownership Mappings
```
@ownership.borrow → @reference.variable.borrow
@ownership.borrow_mut → @reference.variable.borrow_mut
@ownership.deref → @reference.variable.deref
```

#### Lifetime Mappings
```
@lifetime.X → @type.type_parameter.lifetime_X
```

#### Macro Mappings
```
@macro.definition → @definition.macro
@macro.invocation → @reference.macro
```

### Python-Specific

#### Decorator Mappings
```
@decorator.static → @decorator.function.staticmethod
@decorator.classmethod → @decorator.function.classmethod
@decorator.property → @decorator.property
```

#### Reference Mappings
```
@reference.self → @reference.this
@reference.cls → @reference.this.class
@reference.super → @reference.super
@reference.augment → @reference.variable.augmented_assignment
```

### TypeScript-Specific

#### Type Mappings
```
@type.type_annotationd → @type.type_annotation (fix typo)
@definition.return_type → @type.type_annotation.return
@definition.param_property → @definition.parameter.property
```

#### Invalid Category
```
@call.generic → @reference.call.generic
```

## Implementation Strategy

### Step 1: Update .scm Files
Use sed or manual editing to apply mappings systematically:
```bash
# Example for parameter
sed -i 's/@definition\.param\./@definition.parameter./g' file.scm
sed -i 's/@definition\.param\>/@definition.parameter/g' file.scm
```

### Step 2: Update Language Configs
Update the builder config keys to match:
```typescript
// Before
["definition.param", { process: ... }]

// After
["definition.parameter", { process: ... }]
```

### Step 3: Validate
Run validation script:
```bash
node validate_captures.js
```

### Step 4: Test
Run language-specific tests:
```bash
npm test -- semantic_index.javascript.test.ts
```

## Notes

- **Preserve context**: Additional qualifiers after category.entity are crucial
- **Language configs**: Must match the exact full string
- **Backward compatibility**: If changing processed capture names, update all references
- **New entities**: If a concept doesn't fit existing entities, consider adding to SemanticEntity enum