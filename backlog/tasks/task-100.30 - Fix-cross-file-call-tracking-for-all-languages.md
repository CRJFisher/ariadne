---
id: task-100.30
title: Fix cross-file call tracking for all languages
status: To Do
assignee: []
created_date: '2025-08-05 22:38'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Cross-file method resolution is failing for JavaScript (CommonJS), TypeScript (ES6), Python, and Rust. Methods are incorrectly being marked as top-level nodes, and constructor calls are being included incorrectly in TypeScript.

## Root Cause Analysis

The issue is that method calls on imported class instances are not being resolved to the actual class methods. Instead, they're being treated as built-in functions. For example:

```javascript
// calculator.js
class Calculator {
  add(a, b) { return a + b; }
}
module.exports = Calculator;

// compute.js
const Calculator = require('./calculator');
function compute() {
  const calc = new Calculator();
  calc.add(5, 3);  // <-- This resolves to <builtin>#add instead of calculator#Calculator.add
}
```

The type tracking system is not maintaining the connection between:
1. The imported class (`Calculator`)
2. The instance created (`calc`)
3. The method calls on that instance (`calc.add()`)

This affects all languages and is a fundamental limitation in the current type tracking implementation after the refactoring.

## Acceptance Criteria

- [ ] JavaScript CommonJS tests pass
- [ ] TypeScript ES6 import tests pass
- [ ] Python import tests pass
- [ ] Rust use statement tests pass
- [ ] Methods called within modules are not marked as top-level
