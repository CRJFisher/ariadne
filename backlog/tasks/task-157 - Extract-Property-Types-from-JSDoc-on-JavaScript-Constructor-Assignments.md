---
id: task-157
title: Extract Property Types from JSDoc on JavaScript Constructor Assignments
status: To Do
assignee: []
created_date: '2025-10-23 22:06'
labels:
  - enhancement
  - javascript
  - jsdoc
  - properties
dependencies: []
priority: low
---

## Description

Implement extraction of property types from JSDoc comments on constructor assignments in JavaScript classes.

## Background

Currently, javascript_builder.test.ts has a skipped test "should extract type from JSDoc on constructor assignment (not yet implemented)" because the system cannot extract properties that are assigned in the constructor body with JSDoc type annotations.

## Example

```javascript
class Project {
  constructor() {
    /** @type {DefinitionRegistry} */
    this.definitions = new DefinitionRegistry();
  }
}
```

## Current Behavior

- Class-level properties with JSDoc work correctly
- Properties assigned in constructor are NOT extracted as properties
- The `definitions` property is not present in the class properties array

## Expected Behavior

- Constructor assignments of the form `this.propertyName = value` should be extracted as properties
- JSDoc comments immediately preceding these assignments should provide type information
- The property should appear in the class's properties array with the correct type

## Technical Requirements

1. Track assignment expressions in constructor bodies where the left side is a member expression with `this` as the object
2. Associate JSDoc comments that precede these assignments
3. Extract the property name and type from the JSDoc @type annotation
4. Add these as PropertyDefinition entries to the containing class

## Related Files

- Test: packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.test.ts:1710
- Query: packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
- Builder: packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts
