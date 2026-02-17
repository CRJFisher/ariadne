---
paths: packages/*/src/**
---

# Symbol System

## Universal SymbolId

`SymbolId` is the universal identifier for all symbols (functions, classes, methods, variables, etc.). Use `SymbolId` instead of raw strings or individual name types.

```typescript
type SymbolId = string & { __brand: "SymbolId" };
```

**Format:** `kind:file_path:start_line:start_column:end_line:end_column:name`

**Example:** `"function:src/utils.ts:10:0:20:1:processData"`

## Factory Functions

All factory functions live in `packages/types/src/symbol.ts`. Always use them — never construct `SymbolId` strings manually.

```typescript
import {
  function_symbol,
  variable_symbol,
  class_symbol,
  method_symbol,
  property_symbol,
  parameter_symbol,
  interface_symbol,
  enum_symbol,
  enum_member_symbol,
  type_alias_symbol,
  namespace_symbol,
  anonymous_function_symbol,
  module_symbol,
  named_module_symbol,
  constant_symbol,
  decorator_symbol,
} from "@ariadnejs/types";

// Each takes (name: SymbolName, location: Location) → SymbolId
const func_id = function_symbol(name, location);
const class_id = class_symbol(name, location);
const method_id = method_symbol(name, location);
```

## Rules

- Always use `SymbolId` for identifiers — never raw `string`
- Always use factory functions — never construct IDs manually
- All Maps keyed by identifiers use `SymbolId` as the key type
- `SymbolName` is for human-readable names within resolution; `SymbolId` is for globally unique identification
- `ReferenceId` (from `reference_id()`) identifies reference sites, not definitions
