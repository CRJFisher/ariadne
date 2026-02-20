# Task: Add Python Protocol Entity Support

**Status**: Completed
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08
**Completed**: 2025-10-09
**Solution**: Option B - Map Protocol to Interface

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

## Implementation (Completed)

### Decision: Option B - Map Protocol to Interface

**Rationale**: The codebase was **already architected** to treat Python Protocols as interfaces internally:
- `create_protocol_id()` in [python_builder.ts:168-172](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts#L168) returns `interface_symbol()`
- Handler calls `builder.add_interface()`
- Test expectations check `result.interfaces` collection
- Python Protocols are semantically equivalent to TypeScript interfaces (structural subtyping)

Changing capture names aligns the tree-sitter queries with existing behavior, requiring no type system changes.

### Changes Made

#### 1. Query Changes ([python.scm](packages/core/src/index_single_file/query_code_tree/queries/python.scm))

**Protocol Class Detection** (Lines 117, 126):
```diff
-  name: (identifier) @definition.protocol
+  name: (identifier) @definition.interface
```

**Protocol Property Signatures** (Lines 144, 163):
```diff
-  left: (identifier) @definition.property.protocol
+  left: (identifier) @definition.property.interface
```

**Query Pattern Simplification**:
- Removed `type: (_)` field requirement (caused capture mismatches)
- Removed `!right` negation pattern (caused query syntax errors)
- Type annotation filtering moved to handler logic

#### 2. Handler Configuration ([python_builder_config.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts))

**Updated Handler Keys** (Lines 854, 882):
```typescript
// Before:
["definition.protocol", {...}]
["definition.property.protocol", {...}]

// After:
["definition.interface", {...}]
["definition.property.interface", {...}]
```

**Property Handler Enhancement** (Lines 889-894):
```typescript
const protocol_id = find_containing_protocol(capture);
if (!protocol_id) return;

// Only process if there's a type annotation (Protocol property signatures)
const prop_type = extract_property_type(capture.node);
if (!prop_type) return;
```

**Method Handler Enhancement** (Lines 89-100):
```typescript
// Check if this is a Protocol method (should be added to interface)
const protocol_id = find_containing_protocol(capture);
if (protocol_id) {
  builder.add_method_signature_to_interface(protocol_id, {
    symbol_id: method_id,
    name: name,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    return_type: extract_return_type(capture.node.parent || capture.node),
  });
  return;
}
```

#### 3. Test Coverage ([python_builder.test.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.test.ts))

Added comprehensive Protocol test suite (Lines 1139-1324):
- Handler mapping verification
- Protocol class definition handling
- Public/private Protocol export flags
- Protocol property signature extraction with type annotations
- Integration with existing test infrastructure

### Test Results

✅ **Protocol Test**: [semantic_index.python.test.ts:1467](packages/core/src/index_single_file/semantic_index.python.test.ts#L1467) - PASSING
- Extracts Protocol class as interface: `Drawable`
- Captures property signatures: `x: int`, `y: int`
- Captures method signatures: `draw() -> None`, `move(dx: int, dy: int) -> None`
- Correct symbol_id format: `interface:test.py:4:7:4:14:Drawable`

✅ **Python Test Suite**: 45/46 tests passing
- 1 unrelated pre-existing failure in "should extract method resolution metadata for all receiver patterns"
- No regressions introduced by Protocol changes

✅ **Unit Tests**: All Protocol handler tests passing
- Handler mappings present and callable
- Protocol-to-interface conversion working
- Export flag logic correct (public/private)
- Property and method extraction complete

## Acceptance Criteria

- [x] Protocol classes can be indexed without errors
- [x] Test extracts Protocol with properties (x, y)
- [x] Test extracts Protocol with methods (draw, move)
- [x] Protocol definitions have correct symbol_id format (`interface:...`)
- [x] No regressions in Python or other language tests
- [x] Decision documented: **Option B - Map to interface** (aligned with existing architecture)

## Files Modified

1. [python.scm](packages/core/src/index_single_file/query_code_tree/queries/python.scm) - Updated capture names
2. [python_builder_config.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts) - Updated handler keys and logic
3. [python_builder.test.ts](packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.test.ts) - Added Protocol test coverage

## Related

- Python structural typing (PEP 544)
- TypeScript interface handling
- SemanticEntity type system design
- Protocol vs Interface semantic equivalence
