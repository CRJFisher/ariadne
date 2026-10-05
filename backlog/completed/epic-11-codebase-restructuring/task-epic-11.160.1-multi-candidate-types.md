# Task Epic-11.160.1: Multi-Candidate Type Definitions

**Status**: COMPLETED
**Priority**: P0 (Foundational)
**Estimated Effort**: 0.5 days
**Actual Effort**: 0.5 days
**Epic**: epic-11-codebase-restructuring
**Parent**: task-epic-11.160 (Multi-Candidate Resolution Foundation)
**Blocks**: 11.160.2, 11.160.3, 11.160.4

## Scope

Define types for multi-candidate resolution. Change `CallReference` to represent resolutions as an array with structured metadata. Every resolution is treated uniformly as an array, whether it contains zero, one, or multiple candidates.

## Type Definitions

### Location

`packages/types/src/symbol_references.ts`

### Core Types

```typescript
/**
 * Confidence level for symbol resolution
 */
export type ResolutionConfidence =
  | "certain" // Definite resolution (direct or all polymorphic implementations)
  | "probable" // High-confidence heuristic match
  | "possible"; // Lower-confidence candidate

/**
 * Structured reason for resolution
 *
 * Discriminated union allows type-safe analysis and serialization.
 */
export type ResolutionReason =
  | { type: "direct" }
  | { type: "interface_implementation"; interface_id: SymbolId }
  | {
      type: "collection_member";
      collection_id: SymbolId;
      access_pattern?: string;
    }
  | { type: "heuristic_match"; score: number };

/**
 * Single resolution candidate with metadata
 */
export interface Resolution {
  /** Resolved symbol identifier */
  symbol_id: SymbolId;

  /** Confidence level for this resolution */
  confidence: ResolutionConfidence;

  /** Structured reason explaining why this symbol was selected */
  reason: ResolutionReason;
}
```

### Updated CallReference

```typescript
/**
 * Reference to a call site with its resolved targets
 *
 * The resolutions array contains all possible targets:
 * - Empty array: Resolution failed
 * - Single element: Concrete resolution
 * - Multiple elements: Polymorphic/dynamic/ambiguous
 */
export interface CallReference {
  /** Location of the call in source code */
  location: Location;

  /** Name being called */
  name: SymbolName;

  /** Scope containing this call */
  scope_id: ScopeId;

  /** Type of call */
  call_type: "function" | "method" | "constructor";

  /** All resolved candidates with metadata */
  resolutions: Resolution[];
}
```

## Implementation

### 1. Add Resolution Types

**File**: `packages/types/src/symbol_references.ts`

```typescript
import type { SymbolId } from "./symbol_id";

export type ResolutionConfidence = "certain" | "probable" | "possible";

export type ResolutionReason =
  | { type: "direct" }
  | { type: "interface_implementation"; interface_id: SymbolId }
  | {
      type: "collection_member";
      collection_id: SymbolId;
      access_pattern?: string;
    }
  | { type: "heuristic_match"; score: number };

export interface Resolution {
  symbol_id: SymbolId;
  confidence: ResolutionConfidence;
  reason: ResolutionReason;
}
```

### 2. Update CallReference

**File**: `packages/types/src/symbol_references.ts`

Replace existing `CallReference`:

```typescript
export interface CallReference {
  location: Location;
  name: SymbolName;
  scope_id: ScopeId;
  call_type: "function" | "method" | "constructor";
  resolutions: Resolution[]; // NEW: Array of resolutions
}
```

Remove old fields:

- ~~`symbol_id?: SymbolId`~~ (replaced by `resolutions[].symbol_id`)

### 3. Update Index Exports

**File**: `packages/types/src/index.ts`

Add exports:

```typescript
export type {
  ResolutionConfidence,
  ResolutionReason,
  Resolution,
} from "./symbol_references";

export type {
  CallReference, // Updated version
} from "./symbol_references";
```

## Testing

### Type Compilation Tests

**File**: `packages/types/src/__tests__/resolution_types.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import type {
  ResolutionConfidence,
  ResolutionReason,
  Resolution,
  CallReference,
} from "../symbol_references";

describe("Resolution types", () => {
  test("Resolution structure", () => {
    const resolution: Resolution = {
      symbol_id: "test_symbol" as any,
      confidence: "certain",
      reason: { type: "direct" },
    };

    expect(resolution.symbol_id).toBeDefined();
    expect(resolution.confidence).toBe("certain");
    expect(resolution.reason.type).toBe("direct");
  });

  test("ResolutionReason variants", () => {
    const direct: ResolutionReason = { type: "direct" };
    const interface_impl: ResolutionReason = {
      type: "interface_implementation",
      interface_id: "Handler" as any,
    };
    const collection: ResolutionReason = {
      type: "collection_member",
      collection_id: "CONFIG" as any,
      access_pattern: "Map.get",
    };
    const heuristic: ResolutionReason = {
      type: "heuristic_match",
      score: 0.85,
    };

    expect(direct.type).toBe("direct");
    expect(interface_impl.type).toBe("interface_implementation");
    expect(collection.type).toBe("collection_member");
    expect(heuristic.type).toBe("heuristic_match");
  });

  test("CallReference with empty resolutions (failed)", () => {
    const call: CallReference = {
      location: { file_path: "test.ts", start_line: 5, end_line: 5 } as any,
      name: "unknownFunc",
      scope_id: "scope_1" as any,
      call_type: "function",
      resolutions: [],
    };

    expect(call.resolutions).toHaveLength(0);
  });

  test("CallReference with single resolution", () => {
    const call: CallReference = {
      location: { file_path: "test.ts", start_line: 10, end_line: 10 } as any,
      name: "getName",
      scope_id: "scope_2" as any,
      call_type: "method",
      resolutions: [
        {
          symbol_id: "User.getName" as any,
          confidence: "certain",
          reason: { type: "direct" },
        },
      ],
    };

    expect(call.resolutions).toHaveLength(1);
    expect(call.resolutions[0].symbol_id).toBe("User.getName");
  });

  test("CallReference with multiple resolutions (polymorphic)", () => {
    const call: CallReference = {
      location: { file_path: "test.ts", start_line: 15, end_line: 15 } as any,
      name: "handle",
      scope_id: "scope_3" as any,
      call_type: "method",
      resolutions: [
        {
          symbol_id: "HandlerA.handle" as any,
          confidence: "certain",
          reason: {
            type: "interface_implementation",
            interface_id: "Handler" as any,
          },
        },
        {
          symbol_id: "HandlerB.handle" as any,
          confidence: "certain",
          reason: {
            type: "interface_implementation",
            interface_id: "Handler" as any,
          },
        },
      ],
    };

    expect(call.resolutions).toHaveLength(2);
    expect(call.resolutions.every((r) => r.confidence === "certain")).toBe(
      true
    );
    expect(
      call.resolutions.every(
        (r) => r.reason.type === "interface_implementation"
      )
    ).toBe(true);
  });

  test("All confidence levels valid", () => {
    const levels: ResolutionConfidence[] = ["certain", "probable", "possible"];
    expect(levels).toHaveLength(3);
  });
});
```

### Type Discrimination Tests

**File**: `packages/types/src/__tests__/resolution_reason_discrimination.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import type { ResolutionReason } from "../symbol_references";

describe("ResolutionReason discrimination", () => {
  test("discriminate by type field", () => {
    function analyze_reason(reason: ResolutionReason): string {
      switch (reason.type) {
        case "direct":
          return "Direct resolution";
        case "interface_implementation":
          return `Implements ${reason.interface_id}`;
        case "collection_member":
          return `From collection ${reason.collection_id}`;
        case "heuristic_match":
          return `Score: ${reason.score}`;
      }
    }

    const direct: ResolutionReason = { type: "direct" };
    expect(analyze_reason(direct)).toBe("Direct resolution");

    const interface_impl: ResolutionReason = {
      type: "interface_implementation",
      interface_id: "Handler" as any,
    };
    expect(analyze_reason(interface_impl)).toBe("Implements Handler");

    const collection: ResolutionReason = {
      type: "collection_member",
      collection_id: "CONFIG" as any,
    };
    expect(analyze_reason(collection)).toBe("From collection CONFIG");

    const heuristic: ResolutionReason = {
      type: "heuristic_match",
      score: 0.92,
    };
    expect(analyze_reason(heuristic)).toBe("Score: 0.92");
  });

  test("filter by reason type", () => {
    const resolutions = [
      { type: "direct" as const },
      { type: "interface_implementation" as const, interface_id: "I" as any },
      { type: "collection_member" as const, collection_id: "C" as any },
      { type: "heuristic_match" as const, score: 0.8 },
    ];

    const interface_only = resolutions.filter(
      (r) => r.type === "interface_implementation"
    );
    expect(interface_only).toHaveLength(1);

    const direct_only = resolutions.filter((r) => r.type === "direct");
    expect(direct_only).toHaveLength(1);
  });
});
```

## Success Criteria

- [x] All type definitions compile without errors
- [x] `CallReference.resolutions` is array type
- [x] `ResolutionReason` is discriminated union with all variants
- [x] Type tests pass (compilation and runtime validation)
- [x] Types exported from `packages/types/src/index.ts`
- [x] No `symbol_id?: SymbolId` field on `CallReference`
- [x] Documentation comments complete

## Implementation Summary

Successfully implemented all type definitions:

1. **Added to `symbol_references.ts` (lines 269-304)**:
   - `ResolutionConfidence` type
   - `ResolutionReason` discriminated union
   - `Resolution` interface

2. **Updated `call_chains.ts` (lines 48-86)**:
   - Removed `symbol_id?: SymbolId | null`
   - Added `resolutions: readonly Resolution[]`
   - Updated documentation

3. **Type exports**: Auto-exported via existing `export *` statements

4. **Tests created**: `packages/types/tests/resolution_types.test.ts` with comprehensive coverage

## Dependencies

**Requires**:

- Existing types: `SymbolId`, `SymbolName`, `ScopeId`, `Location`

**Blocks**:

- Task 11.160.2: Resolver function updates (needs `Resolution` type)
- Task 11.160.3: Resolution registry updates (needs `CallReference` structure)
- Task 11.160.4: Call graph updates (needs updated `CallReference`)

## Design Rationale

### Why Array Instead of Optional Single?

Every call is potentially multi-candidate. Using an array uniformly handles all cases:

- `[]` = failed
- `[one]` = concrete
- `[a, b, c]` = polymorphic

No special cases, no `| null`, no conditional logic.

### Why Discriminated Union for ResolutionReason?

**Type safety**: Compiler enforces valid field combinations
**Analyzability**: Filter/group by `reason.type`
**Serializability**: JSON-safe, no class instances
**Extensibility**: Add new reason types without breaking existing code

### Why Inline Resolution in CallReference?

**Single source of truth**: All resolution data in one place
**No synchronization**: Can't have mismatched parallel arrays
**Simplicity**: One lookup gets all information

## Out of Scope

- Implementation logic (handled in 11.160.2-4)
- Resolver algorithms
- Collection detection
- Heuristic scoring
- Confidence thresholds

This task is **purely type definitions** - no runtime code.
