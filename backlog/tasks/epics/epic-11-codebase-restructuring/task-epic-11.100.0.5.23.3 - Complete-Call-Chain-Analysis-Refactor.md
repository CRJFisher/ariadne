# Task 11.100.0.5.23.3: Complete Call Chain Analysis Refactor

## Parent Task
11.100.0.5.23 - Symbol Refactor - Function Parameters

## Priority  
**HIGH** - Blocking builds, multiple compilation errors

## Issue Summary
The call_chain_analysis module has numerous type mismatches after the Symbol Refactor, preventing successful compilation.

## Root Cause Analysis
The call_chain_analysis implementation still uses old property names and type structures that don't match the new CallChain/CallChainNode types created in the types package.

## Work Required

### Phase 1: Property Name Updates
- [ ] Update `caller`/`callee` properties to use `symbol_id` in CallChainNode
- [ ] Update `max_depth` to `depth` in CallChain objects  
- [ ] Update `is_recursive` to `has_recursion` in CallChain objects
- [ ] Update `root` to `entry_point` in CallChain objects
- [ ] Add missing `execution_path` property to CallChain objects

### Phase 2: Call Property Access Updates  
Current code accesses old properties on FunctionCall/MethodCall/ConstructorCall:
- [ ] Replace `call.caller_name` with `call.caller` (FunctionCall)
- [ ] Replace `call.callee_name` with `call.callee` (FunctionCall) 
- [ ] Replace `call.receiver_name` with `call.receiver` (MethodCall)
- [ ] Replace `call.constructor_name` with `call.class_name` (ConstructorCall)

### Phase 3: String to SymbolId Conversions
- [ ] Fix `build_call_graph()` to use SymbolId keys instead of strings
- [ ] Add proper SymbolId casting for symbol construction results
- [ ] Update Map<string, Set<string>> to Map<SymbolId, Set<SymbolId>>

### Phase 4: Function Implementation Updates
- [ ] Update `detect_recursion()` to work with new CallChain structure
- [ ] Update `get_longest_chain()` to use new CallChain properties
- [ ] Update `get_recursive_functions()` for new types
- [ ] Update `find_paths_between()` for new CallChainNode structure

## Files to Update
- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`
- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.test.ts`

## Success Criteria
- ✅ All TypeScript compilation errors resolved in call_chain_analysis module
- ✅ Tests pass with new type structure  
- ✅ No breaking changes to public API
- ✅ Maintains backward compatibility where possible

## Dependencies
**Requires**: Completion of parent task 11.100.0.5.23 (Symbol Refactor)

## Estimated Time
1-2 days

## Risk Assessment  
- **Medium Risk**: Complex type refactoring with many interconnected changes
- **Mitigation**: Update incrementally and test after each phase

## Notes
This task completes the call chain analysis refactoring started in the parent task. The types were created but the implementation wasn't fully updated to use them.