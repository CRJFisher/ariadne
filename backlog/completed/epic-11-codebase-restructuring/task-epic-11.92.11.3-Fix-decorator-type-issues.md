# Task: Fix Decorator Type Issues

**Task ID**: task-epic-11.92.11.3
**Parent**: task-epic-11.92.11
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 1.5 hours

## Summary

Fix decorator-related TypeScript errors in the comprehensive_definitions.ts test fixture file.

## Problem

Multiple decorator-related errors in `definitions/fixtures/typescript/comprehensive_definitions.ts`:
- Line 195: TS2664 - Invalid module name in augmentation
- Line 240: TS1240 - Unable to resolve property decorator signature
- Line 243: TS1241 - Unable to resolve method decorator signature
- Line 243: TS1270 - Decorator return type incompatible
- Line 244: TS1206 - Decorators not valid here

These occur in a test fixture that's testing TypeScript decorator parsing.

## Context

This is a test fixture file meant to test various TypeScript constructs including decorators. The errors are preventing compilation but the file is meant to test the parser's ability to handle decorators.

## Solution Options

### Option A: Fix Decorator Implementations
Make decorators TypeScript-compliant:
```typescript
// Property decorator
function PropertyDecorator(target: any, propertyKey: string) {
  // Implementation
}

// Method decorator
function MethodDecorator(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  return descriptor;
}
```

### Option B: Use experimentalDecorators
Ensure tsconfig has proper decorator support:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Option C: Disable Type Checking for Fixtures
Add TypeScript ignore comments or exclude from compilation:
```typescript
// @ts-nocheck
// This file intentionally contains various constructs for parser testing
```

### Option D: Create Valid Test Decorators
Implement decorators that are valid but still test parsing:
```typescript
// Valid decorators that test parsing
function testDecorator(value?: any) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    // Valid decorator implementation
    if (descriptor) return descriptor;
  };
}
```

## Implementation Steps

1. **Review fixture purpose** (20 min)
   - Understand what's being tested
   - Determine if decorators need to be valid
   - Check test expectations

2. **Fix module augmentation** (15 min)
   - Line 195: Fix or remove invalid module augmentation
   - Ensure module name is valid

3. **Fix decorator signatures** (30 min)
   - Update decorator implementations
   - Ensure proper parameter types
   - Fix return types

4. **Verify fixture still works** (25 min)
   - Run parser tests
   - Ensure decorator parsing still tested
   - No test regressions

## Detailed Fixes

### Fix 1: Module Augmentation (Line 195)
```typescript
// Before - invalid module name
declare module 'external-module' {
  // ...
}

// After - valid module name or ambient module
declare module 'some-actual-package' {
  // ...
}

// Or use ambient module
declare module '*.ext' {
  // ...
}

// Or comment out if just for parsing test
// @ts-ignore - Testing module augmentation parsing
declare module 'external-module' {
  // ...
}
```

### Fix 2: Property Decorator (Line 240)
```typescript
// Before - incorrect signature
function propertyDecorator(target: any, key: string): any {
  // ...
}

// After - correct property decorator
function propertyDecorator(target: any, propertyKey: string | symbol): void {
  // Property decorator doesn't return a value
  console.log(`Decorating property: ${String(propertyKey)}`);
}

// Or make it a decorator factory
function propertyDecorator(options?: any) {
  return function (target: any, propertyKey: string | symbol): void {
    // Implementation
  };
}
```

### Fix 3: Method Decorator (Lines 243)
```typescript
// Before - incorrect signature
function methodDecorator(target: any, key: string): PropertyDescriptor {
  // ...
}

// After - correct method decorator
function methodDecorator(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
): PropertyDescriptor | void {
  // Can modify and return descriptor, or return void
  return descriptor;
}

// Or decorator factory
function methodDecorator(options?: any) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    return descriptor;
  };
}
```

### Fix 4: Parameter Decorator (Line 244)
```typescript
// Before - decorators in wrong position
class MyClass {
  method(@param decorator: string) {} // Wrong position
}

// After - correct parameter decorator
function paramDecorator(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number
): void {
  // Parameter decorator implementation
}

class MyClass {
  method(@paramDecorator param: string) {} // Correct usage
}
```

### Complete Valid Example
```typescript
// Valid decorator implementations for testing

// Class decorator
function classDecorator<T extends { new(...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    decorated = true;
  };
}

// Method decorator
function methodDecorator(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${propertyKey}`);
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

// Property decorator
function propertyDecorator(target: any, propertyKey: string): void {
  let value: any;
  Object.defineProperty(target, propertyKey, {
    get: () => value,
    set: (newValue: any) => {
      console.log(`Setting ${propertyKey} to ${newValue}`);
      value = newValue;
    }
  });
}

// Parameter decorator
function paramDecorator(
  target: any,
  propertyKey: string,
  parameterIndex: number
): void {
  console.log(`Parameter ${parameterIndex} of ${propertyKey}`);
}

// Usage
@classDecorator
class DecoratedClass {
  @propertyDecorator
  decoratedProperty: string = '';

  @methodDecorator
  decoratedMethod(@paramDecorator param: string): string {
    return param;
  }
}
```

## Success Criteria

- [ ] All 5 decorator errors resolved
- [ ] Fixture still tests decorator parsing
- [ ] No test regressions
- [ ] Decorators are valid TypeScript
- [ ] Build completes successfully

## Files to Modify

- `src/semantic_index/definitions/fixtures/typescript/comprehensive_definitions.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run definition tests
npx vitest run src/semantic_index/definitions/

# Specific fixture tests
npx vitest run -t "comprehensive_definitions"
```

## Dependencies

- May need to update tsconfig for decorator support
- Related to fixture module references (task-epic-11.92.10.3)

## Notes

- This is a test fixture, not production code
- Balance between valid TypeScript and comprehensive testing
- Document why certain constructs are included
- Consider if decorators should be in separate fixture