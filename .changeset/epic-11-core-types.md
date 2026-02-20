---
"@ariadnejs/core": minor
"@ariadnejs/types": minor
---

Call resolution, Python support, and type system improvements

**@ariadnejs/core**

- Add constructor enrichment and function_call module extraction
- Fix Python instance-method resolution false positives
- Resolve Python submodule import method calls
- Resolve aliased re-exports for TypeScript/JavaScript and Python
- Detect functions passed as values for indirect reachability (fewer false positive entry points)
- Add multi-candidate resolution foundation
- Add callback detection and tracking
- Add factory call tracking for polymorphic resolution
- Add collection reachability and argument resolution
- Migrate codebase to snake_case naming convention

**@ariadnejs/types**

- Rename ClassDefinition.constructor to constructors (array)
- Add access_modifier to method and constructor definitions
- Add is_test field to CallableNode
- Add ExportableDefinition type guard
- Merge TypeContext into TypeRegistry
- Add ResolutionCache
- Add reference factory functions with discriminated unions
