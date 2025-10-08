# Task: Add Python Protocol Entity Support

**Status**: Open
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08

## Problem

Python `Protocol` classes (from `typing.Protocol`) are being captured as a new entity type `"protocol"`, but this entity type is not defined in the `SemanticEntity` enum. This causes a runtime error when trying to build the semantic index.

### Failing Test

Test: [semantic_index.python.test.ts:1453](packages/core/src/index_single_file/semantic_index.python.test.ts#L1453) - "should extract Protocol classes with property signatures"

**Error**:
```
Error: Invalid entity: protocol
  at build_semantic_index (semantic_index.ts:123:13)
```

**Test Code:**
```python
from typing import Protocol

class Drawable(Protocol):
    x: int
    y: int

    def draw(self) -> None:
        ...

    def move(self, dx: int, dy: int) -> None:
        ...
```

### Root Cause

Python query or builder is creating definitions with entity type `"protocol"`, but:
1. `SemanticEntity` enum in types doesn't include `"protocol"`
2. The semantic_index validation rejects unknown entity types

## Background: Python Protocols

Python Protocols (PEP 544) are structural typing interfaces:
- Similar to TypeScript interfaces or Go interfaces
- Define method/property signatures
- Duck typing with static type checking
- Used for type hints, not runtime inheritance

**Key question**: Should Protocols be treated as:
- **Option A**: A new entity type `"protocol"` (requires enum change)
- **Option B**: Mapped to existing `"interface"` type (Protocols are interface-like)

## Investigation Steps

1. **Find where "protocol" entity is created**:
   - Search in [python.scm](packages/core/src/index_single_file/query_code_tree/queries/python.scm) for `@definition.protocol`
   - Search in [python_builder.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts)

2. **Check SemanticEntity enum**:
   - Location: [@ariadnejs/types](packages/types/src/index.ts)
   - Current values: class, interface, function, variable, etc.
   - Determine if protocol should be added or mapped

3. **Review Protocol usage**:
   - How do other type systems handle structural interfaces?
   - TypeScript: uses `interface`
   - Go: uses `interface`
   - Rust: uses `trait` (but traits are different)

## Solution Approach

### Option A: Add "protocol" to SemanticEntity Enum (Recommended)

This maintains semantic distinction between:
- `class`: Nominal typing, runtime inheritance
- `interface`: Explicit interface declarations (TypeScript)
- `protocol`: Structural typing, duck typing (Python)

**Changes needed**:

1. Add to `SemanticEntity` enum in [types/src/index.ts](packages/types/src/index.ts):
   ```typescript
   export enum SemanticEntity {
     class = "class",
     interface = "interface",
     protocol = "protocol",  // NEW
     // ...
   }
   ```

2. Update semantic_index.ts to handle protocol:
   - Add to entity map collections
   - Store in `index.protocols` (new Map)
   - Similar to how interfaces are handled

3. Update type definitions:
   ```typescript
   export type Protocol = {
     kind: "protocol";
     name: string;
     symbol_id: SymbolId;
     properties: Property[];
     methods: Method[];
     // ... other fields
   };
   ```

### Option B: Map Protocol to Interface (Simpler)

Change the Python query/builder to emit `@definition.interface` instead of `@definition.protocol`.

**Changes needed**:

1. Find and replace in python.scm or python_builder.ts:
   - Change `"protocol"` to `"interface"`
   - Protocols get treated as interfaces

**Pros**:
- No type system changes
- Simpler implementation
- Protocols are semantically similar to interfaces

**Cons**:
- Loses semantic distinction
- Can't differentiate Protocol from Interface in mixed codebases
- Python-specific typing nuances lost

### Recommendation

Use **Option A** if:
- We want to preserve Python's structural typing semantics
- We may add Protocol-specific features later
- We want accurate representation of Python type system

Use **Option B** if:
- We want to minimize type system complexity
- Interface is "good enough" for our use cases
- We're unlikely to need Protocol-specific behavior

## Testing

```bash
# Run failing test
npm test -- semantic_index.python.test.ts -t "should extract Protocol classes"

# After fix, verify:
# - Protocol classes are extracted without errors
# - Properties and methods are captured
# - Symbol IDs are created correctly
# - No regressions in other Python tests
```

## Acceptance Criteria

- [ ] Protocol classes can be indexed without errors
- [ ] Test extracts Protocol with properties (x, y)
- [ ] Test extracts Protocol with methods (draw, move)
- [ ] Protocol definitions have correct symbol_id format
- [ ] No regressions in Python or other language tests
- [ ] Decision documented: protocol as new entity OR mapped to interface

## Related

- Python structural typing (PEP 544)
- TypeScript interface handling
- SemanticEntity type system design
