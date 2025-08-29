---
id: task-epic-11.46
title: Migrate index.ts
status: To Do
assignee: []
created_date: "2025-08-20"
labels: [migration, foundation, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

All the tasks from epic-11.6 to epic-11.46 were completed without connecting up the functionality. Also there could be incomplete functionality.
Also, tests have been added to the /tests folder, not added inline alongside the code - this needs to be fixed.
We also need to verify that we are using the maximum multi-language / shared processing per feature. I'm concerned that the language-specific processing files have been written for every feature without considering if there is shared processing logic.
Are tests using the real `.scm` files or are they creating bespoke parsing logic? I've seen some lisp-style syntax whizzing past in the CC terminal. We should be using the real `.scm` files for tests.
Make sure the `index.ts` files are using the correct dispatcher/marshaler pattern i.e. using if/switch, not objects containing function references looped up dynamically.

## Acceptance Criteria

- [ ] All functionality is connected up
- [ ] All the test cases have been migrated to the new code
- [ ] All tests are added inline alongside the code
- [ ] All tests pass
- [ ] All code is properly linted and type checked
- [ ] All code is properly documented
- [ ] All code is properly tested
- [ ] All code is properly documented
- [ ] All 'shared' (cross-module) types are in the packages/types package
