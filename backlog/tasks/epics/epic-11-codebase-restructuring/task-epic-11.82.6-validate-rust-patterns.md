# Task 11.82.6: Validate and Complete Rust Constructor Detection

## Parent Task
11.82 - Refactor constructor_calls to Configuration-Driven Pattern

## Overview
Validate that all Rust constructor patterns are properly detected and fix any gaps in coverage.

## Patterns to Validate

### Currently Implemented
- ✅ `Type::new()` - Associated function pattern
- ✅ `Point { x: 1, y: 2 }` - Struct literals  
- ⚠️ `Enum::Variant(data)` - Tuple enum variants
- ⚠️ `Enum::Variant { fields }` - Struct enum variants

### Needs Validation
```rust
// Tuple structs
let p = Point(1, 2);  // Should work via bespoke

// Smart pointers
let b = Box::new(value);     // Should work
let rc = Rc::new(value);      // Should work
let arc = Arc::new(value);    // Should work

// Macros
let v = vec![1, 2, 3];        // Should work via bespoke
let m = hashmap!{};           // Should work via bespoke

// Default trait
let d: MyStruct = Default::default();  // Should work

// Builder pattern
let obj = Builder::new()
    .field1(val1)
    .field2(val2)
    .build();  // Should detect .build() as constructor

// From/Into traits
let s = String::from("hello");  // Should work
let n: i32 = "42".parse()?;     // May need special handling
```

## Issues to Fix

### 1. Struct Expression Field Count
The generic processor properly counts fields now (fixed)

### 2. Enum Variant Detection
Needs validation that all enum patterns work:
- Simple variants: `Option::None`
- Tuple variants: `Option::Some(value)`
- Struct variants: `Error::Custom { msg: "error" }`

### 3. Macro Detection
The bespoke handler exists but needs validation

### 4. Builder Pattern
Not currently detected - may need enhancement

## Acceptance Criteria
- [ ] Validate all listed patterns are detected
- [ ] Fix any patterns that don't work
- [ ] Add builder pattern detection
- [ ] Ensure field/argument counting is accurate
- [ ] Create comprehensive test suite
- [ ] Document Rust-specific patterns
- [ ] Handle generic type parameters

## Test Coverage Required
- Each pattern type (struct, enum, macro, etc.)
- Edge cases (empty structs, unit enums)
- Generic types
- Nested constructors
- Method chaining patterns

## Technical Notes
- Rust has many constructor patterns
- No single "new" keyword like JavaScript
- Must handle ownership patterns
- Consider lifetime annotations

## Priority
HIGH - Rust is a primary supported language