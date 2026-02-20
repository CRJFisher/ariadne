---
id: task-156
title: Support Aliased Re-Exports in Resolution Registry
status: To Do
assignee: []
created_date: '2025-10-23 22:05'
labels:
  - bug
  - resolution
  - re-exports
dependencies: []
priority: medium
---

## Description

Fix resolution of aliased re-exports (export { originalName as aliasedName }) so that imports using the alias can be properly resolved to the original symbol.

## Background

Currently, resolution_registry.test.ts has a skipped test "should handle re-exports with aliases" that fails because the resolution system cannot resolve imports that use an aliased re-export.

## Example

```typescript
// original.ts
export function originalName(x: number): number { return x + 1; }

// index.ts
export { originalName as aliasedName } from "./original";

// consumer.ts
import { aliasedName } from "./index";
export function use_aliased(y: number): number {
  return aliasedName(y);  // ❌ Resolution returns null
}
```

## Current Behavior

When resolving the symbol "aliasedName" in consumer.ts scope:
- Expected: Resolves to originalName symbol from original.ts
- Actual: Returns null

## Related Files

- Test: packages/core/src/resolve_references/resolution_registry.test.ts:303
- Implementation: packages/core/src/resolve_references/resolution_registry.ts
- Export registry: packages/core/src/resolve_references/registries/export_registry.ts
