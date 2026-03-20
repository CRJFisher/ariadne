---
id: task-194
title: Add async field to FunctionDefinition and restore Python async capture
status: To Do
assignee: []
created_date: '2026-03-03 15:30'
labels: []
dependencies: []
---

## Description

FunctionDefinition in @ariadnejs/types has no async field. The @definition.function.async patterns were removed from python.scm in task-192 because they caused duplicate symbols and the type system had nowhere to store the async flag. The correct fix is to add async?: boolean to FunctionSignature, restore async-aware patterns in python.scm, and update handle_definition_function to set the flag. Also clean up MethodDefinition which spreads async at runtime via add_method_to_class without a declared type field.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 FunctionSignature has async?: boolean field,Python async functions are indexed with async=true in their definition,Async decorated functions also carry the flag,MethodDefinition type declares async consistently with the runtime spread,No duplicate symbols produced for async functions
<!-- AC:END -->
