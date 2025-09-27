# Task: Add Function Reference Tracking to Call Resolution

**ID**: task-epic-11.99
**Epic**: epic-11-codebase-restructuring
**Status**: Not Started
**Priority**: High
**Dependencies**: task-epic-11.91.2 (Function call resolution), task-epic-11.91.3 (Method/constructor resolution)

## Summary

Add comprehensive type and reference tracking to function call resolution to handle languages that pass function references (as variables, parameters, return values, etc.) and trace these back to their original definitions through the complete reference chain.

## Problem Statement

Current function call resolution directly matches call sites to definitions but doesn't handle:
- Functions passed as parameters to other functions
- Functions stored in variables and called later
- Functions returned from other functions
- Method references passed around (e.g., `obj.method` without calling)
- Callback patterns and higher-order functions
- Function references in data structures (arrays, objects, maps)
- Partial application and currying patterns

## Requirements

### Core Functionality

1. **Reference Chain Tracking**
   - Track when functions are assigned to variables
   - Track when functions are passed as parameters
   - Track when functions are returned from other functions
   - Build a complete reference chain from usage to original definition

2. **Parameter Type Flow**
   - Track function types through parameter passing
   - Resolve callback parameters to their definitions
   - Handle generic function parameters (e.g., `Array.map(callback)`)

3. **Variable Assignment Tracking**
   - Track function assignments: `const fn = someFunction`
   - Track method references: `const method = obj.method`
   - Track dynamic assignments: `let fn; fn = condition ? funcA : funcB`

4. **Return Value Tracking**
   - Track functions returned from other functions
   - Handle factory patterns returning functions
   - Track closures and their captured context

### Language-Specific Features

#### JavaScript/TypeScript
- Arrow functions assigned to variables
- Function expressions in callbacks
- Method binding: `this.method.bind(this)`
- Destructured function imports
- Dynamic method access: `obj[methodName]`

#### Python
- First-class functions
- Lambda expressions
- Method references: `obj.method` (unbound)
- Decorators that return functions
- `functools.partial` applications

#### Rust
- Function pointers: `fn(i32) -> i32`
- Closures with captured variables
- Method references through trait objects
- Function items vs function pointers
- Higher-ranked trait bounds with function types

### Integration Points

1. **Symbol Resolution Integration**
   - Use existing scope resolution for variable lookups
   - Leverage import resolution for cross-file tracking
   - Integrate with type resolution for method references

2. **Type System Integration**
   - Track function signatures through assignments
   - Preserve generic type parameters
   - Handle type inference for callbacks

3. **Call Graph Enhancement**
   - Include indirect calls through references
   - Show complete call chains including intermediates
   - Differentiate direct calls from reference calls

## Implementation Approach

### Phase 1: Infrastructure

1. **Extend SymbolDefinition**
   ```typescript
   interface FunctionReference {
     symbol: SymbolId;           // Reference variable/parameter
     target: SymbolId;           // Target function definition
     reference_type: 'assignment' | 'parameter' | 'return' | 'property';
     location: Location;
   }
   ```

2. **Create Reference Resolver**
   - Build on existing function resolution
   - Add reference chain builder
   - Integrate with type tracking

### Phase 2: Core Implementation

1. **Variable Assignment Detection**
   - Query patterns for function assignments
   - Track reassignments and updates
   - Handle destructuring patterns

2. **Parameter Flow Analysis**
   - Track function parameters in calls
   - Build parameter-to-argument mappings
   - Resolve callbacks to definitions

3. **Return Value Analysis**
   - Track function return types
   - Follow returned functions to usage
   - Handle factory patterns

### Phase 3: Language Handlers

1. **JavaScript/TypeScript Handler**
   - Arrow function tracking
   - Method binding detection
   - Dynamic property access

2. **Python Handler**
   - Lambda tracking
   - Decorator handling
   - Method reference resolution

3. **Rust Handler**
   - Function pointer tracking
   - Closure capture analysis
   - Trait method resolution

### Phase 4: Testing and Integration

1. **Unit Tests**
   - Test each reference type
   - Test chain building
   - Test cross-file references

2. **Integration Tests**
   - Real-world callback patterns
   - Complex reference chains
   - Performance validation

## Success Criteria

- [ ] Can trace function calls through variable assignments
- [ ] Can resolve callbacks passed as parameters
- [ ] Can track functions returned from other functions
- [ ] Can handle method references (unbound methods)
- [ ] Works across all supported languages
- [ ] Maintains performance with deep reference chains
- [ ] Integrates cleanly with existing call resolution

## Test Cases

1. **Simple Assignment**
   ```javascript
   const myFunc = originalFunction;
   myFunc(); // Should resolve to originalFunction
   ```

2. **Callback Parameter**
   ```javascript
   array.map(item => process(item)); // Should resolve process
   array.forEach(processItem); // Should resolve processItem
   ```

3. **Factory Pattern**
   ```javascript
   function createHandler(type) {
     return function handler() { /* ... */ };
   }
   const handler = createHandler('click');
   handler(); // Should resolve to returned function
   ```

4. **Method Reference**
   ```python
   class MyClass:
     def method(self): pass

   obj = MyClass()
   ref = obj.method
   ref()  # Should resolve to MyClass.method
   ```

## Notes

- Consider caching reference chains for performance
- May need to handle circular references
- Consider partial resolution for dynamic cases
- Integration with type inference will be critical for accuracy

## Related Tasks

- task-epic-11.91.2.2 - Function call resolution with import integration
- task-epic-11.91.3.1 - Basic method resolution and type lookup
- task-epic-11.96 - Type resolution consolidation