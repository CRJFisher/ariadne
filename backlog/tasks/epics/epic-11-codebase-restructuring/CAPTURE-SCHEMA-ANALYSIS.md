# Capture Schema Analysis

**Date**: 2025-10-29
**Languages Analyzed**: TypeScript, JavaScript, Python, Rust
**Purpose**: Inform canonical schema design for Task 11.154

---

## Executive Summary

### Capture Statistics

| Language | Total Captures | Unique Captures | Categories | Entities |
|----------|----------------|-----------------|------------|----------|
| typescript | 246 | 118 | 11 | 32 |
| javascript | 153 | 79 | 11 | 19 |
| python | 193 | 79 | 10 | 25 |
| rust | 298 | 117 | 11 | 31 |

### Key Findings

- **Common captures** (in ALL languages): 24
- **Duplicate patterns identified**: 1
- **Language-specific captures**: 138

---

## Common Captures

These captures appear in ALL four languages:

- `@assignment.variable`
- `@definition.class`
- `@definition.constructor`
- `@definition.field`
- `@definition.function`
- `@definition.method`
- `@definition.parameter`
- `@definition.variable`
- `@export.variable`
- `@modifier.visibility`
- `@reference.call`
- `@reference.call.chained`
- `@reference.super`
- `@reference.this`
- `@reference.type_reference`
- `@reference.variable`
- `@reference.variable.base`
- `@reference.variable.source`
- `@reference.variable.target`
- `@return.variable`
- `@scope.block`
- `@scope.class`
- `@scope.function`
- `@scope.module`

---

## Duplicate Pattern Analysis

### Method Call Duplicates

**Problematic captures**: `@reference.call.full`, `@reference.call.chained`

**Found in**: typescript, javascript, python, rust

**Issue**: Creates multiple captures for the same syntactic construct, causing ambiguity in reference resolution and false self-references in call graph detection.

**Examples**:
```
typescript:705 - ) @reference.call.full
typescript:714 - property: (property_identifier) @reference.call.chained
javascript:385 - ) @reference.call.full
javascript:394 - property: (property_identifier) @reference.call.chained
python:586 - ) @reference.call.full
python:595 - attribute: (identifier) @reference.call.chained
```

**Recommendation**: Use single capture on call_expression node only. Extract method name via metadata extractors.

---

## Language-Specific Captures

### Typescript-Specific (33 captures)

- `@assignment.constructor`
- `@assignment.variable.arrow`
- `@assignment.variable.constructor`
- `@decorator.class`
- `@decorator.method`
- `@definition.enum.member`
- `@definition.enum_member.value`
- `@definition.field.param_property`
- `@definition.field.private`
- `@definition.interface.property`
- `@definition.method.abstract`
- `@definition.method.private`
- `@definition.namespace`
- `@definition.parameter.optional`
- `@definition.parameter.rest`
- `@definition.variable.destructured`
- `@export.namespace.alias`
- `@export.namespace.source`
- `@export.namespace.source.aliased`
- `@export.type_alias`
- ... and 13 more

### Javascript-Specific (14 captures)

- `@_require`
- `@_simple_import`
- `@definition.class.documentation`
- `@definition.function.documentation`
- `@definition.import.require`
- `@definition.import.require.simple`
- `@definition.method.documentation`
- `@definition.variable.documentation`
- `@definition.variable.documented`
- `@export.namespace`
- `@reference.constructor.assigned`
- `@scope.class.documented`
- `@scope.function.documented`
- `@scope.method.documented`

### Python-Specific (24 captures)

- `@_all_var`
- `@assignment.variable.lambda`
- `@assignment.variable.multiple`
- `@assignment.variable.tuple`
- `@assignment.variable.typed`
- `@decorator.function`
- `@decorator.variable`
- `@definition.import`
- `@definition.method.class`
- `@definition.method.static`
- `@definition.parameter.args`
- `@definition.parameter.default`
- `@definition.parameter.kwargs`
- `@definition.parameter.typed`
- `@definition.parameter.typed.default`
- `@definition.property.interface`
- `@definition.variable.multiple`
- `@definition.variable.tuple`
- `@definition.variable.typed`
- `@reference.call.decorator`
- ... and 4 more

### Rust-Specific (67 captures)

- `@capture`
- `@decorator.macro`
- `@definition.class.generic`
- `@definition.constant`
- `@definition.enum.generic`
- `@definition.function.accepts_impl`
- `@definition.function.async_closure`
- `@definition.function.async_move_closure`
- `@definition.function.closure`
- `@definition.function.const`
- `@definition.function.generic`
- `@definition.function.returns_impl`
- `@definition.function.unsafe`
- `@definition.interface.generic`
- `@definition.macro`
- `@definition.method.async`
- `@definition.method.default`
- `@definition.module`
- `@definition.module.public`
- `@definition.parameter.closure`
- ... and 47 more

---

## Detailed Statistics by Language

### Typescript

- **Total captures**: 246
- **Unique captures**: 118

**By Category**:
- definition: 65
- reference: 61
- scope: 33
- type: 20
- export: 18
- import: 15
- assignment: 12
- modifier: 11
- decorator: 8
- return: 2
- _import_name: 1

**By Entity** (top 10):
- variable: 45
- method: 18
- call: 17
- function: 15
- reexport: 15
- field: 13
- block: 10
- property: 10
- class: 9
- type_reference: 9

### Javascript

- **Total captures**: 153
- **Unique captures**: 79

**By Category**:
- reference: 50
- definition: 32
- scope: 24
- import: 15
- export: 13
- assignment: 8
- _require: 4
- modifier: 3
- return: 2
- _import_name: 1
- _simple_import: 1

**By Entity** (top 10):
- variable: 41
- reexport: 15
- call: 14
- function: 13
- block: 10
- method: 7
- class: 7
- property: 7
- import: 6
- constructor: 5

### Python

- **Total captures**: 193
- **Unique captures**: 79

**By Category**:
- reference: 63
- definition: 46
- scope: 24
- type: 19
- assignment: 16
- modifier: 7
- export: 7
- decorator: 5
- return: 4
- _all_var: 2

**By Entity** (top 10):
- variable: 53
- type_reference: 20
- block: 15
- call: 14
- property: 12
- import: 8
- function: 7
- method: 7
- visibility: 7
- parameter: 6

### Rust

- **Total captures**: 298
- **Unique captures**: 117

**By Category**:
- reference: 83
- definition: 59
- type: 45
- import: 34
- export: 31
- scope: 16
- modifier: 15
- decorator: 9
- capture: 2
- assignment: 2
- return: 2

**By Entity** (top 10):
- variable: 82
- type_reference: 34
- import: 34
- function: 21
- macro: 21
- visibility: 12
- call: 12
- block: 10
- module: 9
- interface: 6

---

## Recommendations for Canonical Schema

### Required Captures

Based on common captures, these should be required in all languages:

- `@assignment.variable` - [Description needed]
- `@definition.class` - [Description needed]
- `@definition.constructor` - [Description needed]
- `@definition.field` - [Description needed]
- `@definition.function` - [Description needed]
- `@definition.method` - [Description needed]
- `@definition.parameter` - [Description needed]
- `@definition.variable` - [Description needed]
- `@export.variable` - [Description needed]
- `@modifier.visibility` - [Description needed]
- `@reference.call` - [Description needed]
- `@reference.super` - [Description needed]
- `@reference.this` - [Description needed]
- `@reference.type_reference` - [Description needed]
- `@reference.variable` - [Description needed]
- `@reference.variable.base` - [Description needed]
- `@reference.variable.source` - [Description needed]
- `@reference.variable.target` - [Description needed]
- `@return.variable` - [Description needed]
- `@scope.block` - [Description needed]
- `@scope.class` - [Description needed]
- `@scope.function` - [Description needed]
- `@scope.module` - [Description needed]

### Prohibited Patterns

These patterns should be explicitly prohibited:

1. **Duplicate method call captures**: `@reference.call.full`, `@reference.call.chained`, `@reference.call.deep`
   - **Reason**: Creates duplicate captures causing false self-references
   - **Alternative**: Single `@reference.call` on call_expression node

2. **Over-nesting** (>3 parts): `@a.b.c.d`
   - **Reason**: Indicates over-granular captures
   - **Alternative**: Simplify to `@category.entity.qualifier`

---

## Next Steps

1. Review findings with team
2. Use this analysis to design canonical schema (Task 11.154.2)
3. Prioritize fixes by impact
