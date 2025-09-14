# Task 11.100.0.5.follow-up-2: Fix Call Chain Analysis Type Mismatches

## Context
The call chain analysis module has significant type mismatches after the Epic 11 refactoring. Property names don't match between interfaces, and there are SymbolId vs string type conflicts throughout.

## Problem Statement
Call chain analysis is failing due to:
1. Property name mismatches: `caller/callee` vs `symbol_id`
2. Missing required properties: `is_recursive`, `cycle_point` on CallChain type
3. Inconsistent use of SymbolId vs string throughout call analysis
4. Type assertions failing due to structure mismatches

## Acceptance Criteria
- [ ] All property names are consistent across interfaces
- [ ] CallChain type has all required properties
- [ ] SymbolId is used consistently for all symbol references
- [ ] No type casting with 'as any' in call chain analysis
- [ ] Call chain analysis tests pass

## Specific Changes Required

### packages/core/src/call_graph/call_chain_analysis/

#### Update CallChain Interface
```typescript
// Current (broken)
interface CallChain {
  caller: string;
  callee: string;
  max_depth: number;
}

// Should be
interface CallChain {
  symbol_id: SymbolId;
  target_id: SymbolId;
  depth: number;
  is_recursive: boolean;
  cycle_point?: SymbolId;
}
```

#### Fix Function Signatures
- Update all functions expecting caller/callee to use symbol_id/target_id
- Change string parameters to SymbolId
- Update return types to match new interface

#### Files to Update
- call_chain_analysis.ts
- call_chain_builder.ts
- recursive_call_detector.ts
- call_chain_utils.ts
- All test files in __tests__/call_chain/

## Migration Strategy
1. Update interface definitions first
2. Fix function signatures to accept SymbolId
3. Update implementation logic for new property names
4. Fix test expectations
5. Remove any temporary type assertions

## Testing
- All call chain analysis tests pass
- Can successfully analyze recursive functions
- Cycle detection works correctly
- Performance is not degraded

## Dependencies
- Requires Phase 1.1 (type exports) to be complete
- May affect call graph visualization if property names change

## Notes
- This is critical for call graph functionality
- Coordinate with call graph visualization team
- Ensure backward compatibility if API is public