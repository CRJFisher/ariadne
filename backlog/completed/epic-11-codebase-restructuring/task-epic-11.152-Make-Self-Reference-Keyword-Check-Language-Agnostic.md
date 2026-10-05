---
id: task-152
title: Make Self-Reference Keyword Check Language-Agnostic
status: To Do
assignee: []
created_date: '2025-10-24 07:54'
labels:
  - enhancement
  - cross-language
  - method-resolution
dependencies: []
priority: medium
---

## Description

Make the self-reference keyword check in method_resolver.ts language-agnostic to support multiple languages.

## Background

Currently, method_resolver.ts has a hardcoded check for the "this" keyword when resolving property chains in method calls:

```typescript
if (prop_name === "this") {
  // Special handling for "this" keyword
  // Find the containing class/interface scope
  ...
}
```

This only works for JavaScript/TypeScript. Other languages use different keywords:
- Python: `self`
- Rust: `self`
- Swift: `self`
- Ruby: `self`

## Problem

Method call resolution will fail for Python code like:
```python
class MyClass:
    def method(self):
        self.other_method()  # ❌ Won't resolve because checking for "this"
```

## Proposed Solution

Add a language-specific helper to check if a name is a self-reference keyword:

```typescript
// In language-specific utilities
function is_self_reference_keyword(name: SymbolName, language: Language): boolean {
  switch (language) {
    case "javascript":
    case "typescript":
      return name === "this";
    case "python":
    case "rust":
      return name === "self";
    default:
      return false;
  }
}

// In method_resolver.ts
if (is_self_reference_keyword(prop_name, language)) {
  // Special handling for self-reference keyword
  ...
}
```

## Implementation

1. Create language utility function for self-reference keyword detection
2. Update method_resolver.ts to use the language-agnostic check
3. Add tests for Python self-reference resolution
4. Add tests for Rust self-reference resolution
5. Update documentation to mention cross-language support

## Related Files

- packages/core/src/resolve_references/call_resolution/method_resolver.ts:240
- Related to method call resolution across languages
