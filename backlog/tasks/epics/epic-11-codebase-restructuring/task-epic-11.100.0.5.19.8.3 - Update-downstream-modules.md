---
id: task-epic-11.100.0.5.19.8.3
title: Update downstream modules that consume function_calls module
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['integration', 'call-graph', 'types']
dependencies: ['task-epic-11.100.0.5.19.8', 'task-epic-11.100.0.5.19.8.1']
parent_task_id: task-epic-11.100.0.5.19.8
priority: medium
---

## Description

Update modules throughout the codebase that import and use the function_calls module to work with the new CallInfo structure instead of the deprecated FunctionCallInfo structure.

## Affected Areas

Based on compilation testing, several modules need updates to handle the new function_calls interface:

### 1. File Analyzer Integration
- `packages/core/src/file_analyzer.ts` - likely imports and uses function_calls functionality
- May need to update how it processes and integrates function call data

### 2. Import/Export Type Resolution
- Modules that combine function call data with import/export analysis
- Type tracking systems that use function call information

### 3. Scope Analysis Integration
- Modules that correlate function calls with scope information
- Symbol resolution that depends on call graph data

## Potential Issues to Address

### 1. Import Statement Updates
```typescript
// OLD imports
import { FunctionCallInfo } from '@ariadnejs/types';

// NEW imports
import { CallInfo, is_function_call, is_method_call, is_constructor_call } from '@ariadnejs/types';
```

### 2. Property Access Pattern Updates
```typescript
// OLD property access
functionCallInfo.caller_name
functionCallInfo.callee_name
functionCallInfo.is_method_call

// NEW discriminated union access
if (is_function_call(callInfo)) {
  callInfo.caller
  callInfo.callee
} else if (is_method_call(callInfo)) {
  callInfo.caller
  callInfo.receiver
  callInfo.method_name
}
```

### 3. Data Processing Updates
```typescript
// OLD processing
const functionCalls = allCalls.filter(call => !call.is_method_call);
const methodCalls = allCalls.filter(call => call.is_method_call);

// NEW processing
const functionCalls = allCalls.filter(is_function_call);
const methodCalls = allCalls.filter(is_method_call);
const constructorCalls = allCalls.filter(is_constructor_call);
```

## Discovery Process

### Phase 1: Identify Affected Modules
1. Search for imports of function_calls module
2. Search for usage of FunctionCallInfo type
3. Search for property access patterns (caller_name, callee_name, etc.)
4. Review compilation errors for related modules

### Phase 2: Update Module Interfaces
1. Update import statements
2. Update type annotations
3. Update property access patterns
4. Update data processing logic

### Phase 3: Integration Testing
1. Verify modules work with stubbed function_calls (returns empty arrays)
2. Test integration points with other refactored modules
3. Ensure no regression in existing functionality

## Search Commands for Discovery

```bash
# Find modules importing function_calls
grep -r "from.*function_calls" packages/core/src/

# Find FunctionCallInfo usage
grep -r "FunctionCallInfo" packages/core/src/ --exclude-dir=call_graph

# Find old property patterns
grep -r "caller_name\|callee_name" packages/core/src/ --exclude-dir=call_graph

# Find is_method_call usage patterns
grep -r "is_method_call\|is_constructor_call" packages/core/src/
```

## Implementation Strategy

### Immediate Priority
- Focus on modules that prevent compilation
- Update import statements and basic type references
- Ensure compatibility with stubbed function_calls implementation

### Future Priority (After task 11.100.4)
- Update modules to take advantage of new CallInfo structure
- Optimize data processing with discriminated union patterns
- Add comprehensive integration testing

## Acceptance Criteria

- [ ] All compilation errors related to function_calls usage resolved
- [ ] Modules work correctly with stubbed function_calls implementation
- [ ] Import statements updated to use new types
- [ ] Property access patterns updated for CallInfo structure
- [ ] Integration points tested and verified
- [ ] No regression in existing functionality
- [ ] Documentation updated for any public API changes

## Risk Assessment

**Medium Risk**: This task touches multiple modules across the codebase. Changes should be made incrementally with thorough testing to avoid introducing regressions.

**Mitigation**:
- Make minimal changes initially to restore compilation
- Test each module individually after updates
- Coordinate with other refactoring tasks to avoid conflicts