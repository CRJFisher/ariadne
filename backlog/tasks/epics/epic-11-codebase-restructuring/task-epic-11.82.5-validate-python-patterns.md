# Task 11.82.5: Validate and Fix Python Constructor Detection

## Parent Task
11.82 - Refactor constructor_calls to Configuration-Driven Pattern

## Overview
Python constructor detection is partially broken. The configuration uses wrong field names and some patterns aren't detected.

## Issues Found

### 1. Field Name Issue (FIXED)
- Python AST uses `function` field, not `func` for call nodes
- Already fixed in language_configs.ts

### 2. Missing Pattern Detection
- `module.Class()` pattern not detected
- `self.property = Constructor()` assignments not tracked
- Dataclass instantiation with keyword arguments

### 3. Incomplete Bespoke Handlers
Current handlers don't properly detect:
- Named constructor parameters
- Class method factories like `Class.from_dict()`
- Type hints in constructor calls

## Test Cases to Validate

```python
# Basic class instantiation
p = Person("Alice")  # ✅ Works - VERIFIED

# Module qualified
obj = module.SubClass()  # ✅ Works - VERIFIED

# Property assignment  
self.data = DataClass()  # ✅ Works - VERIFIED

# Dataclass with keywords
user = User(name="Bob", age=30)  # ✅ Works - VERIFIED (2 args counted)

# Factory methods
config = Config.from_dict(data)  # ✅ Works - VERIFIED

# Super calls
super().__init__(args)  # ✅ Works via bespoke - VERIFIED

# Metaclass
class Meta(type): pass
class MyClass(metaclass=Meta): pass  # N/A - This is a class definition, not a constructor call
```

## Acceptance Criteria
- [x] Detect module-qualified constructor calls - VERIFIED
- [x] Track self/cls property assignments as type info - VERIFIED (self.data = DataClass() works)
- [x] Properly count keyword arguments - VERIFIED (counts 2 args for User(name="Bob", age=30))
- [x] Detect @classmethod factory patterns - VERIFIED (Config.from_dict() detected)
- [x] Handle metaclass instantiation - N/A (class definitions with metaclass are not constructor calls)
- [x] Add comprehensive test coverage for all patterns - COMPLETE (tests added in task 11.82.3)
- [x] Document Python-specific quirks - COMPLETE

## Implementation Tasks
1. Review Python AST structure for all patterns
2. Update language_configs.ts if needed
3. Enhance Python bespoke handlers
4. Add missing pattern detection
5. Create comprehensive tests

## Technical Notes
- Python doesn't have explicit constructor syntax
- Relies on capitalization convention
- Must handle various factory patterns
- Consider dataclasses and metaclasses

## Priority
HIGH - Python is a primary supported language

## Implementation Notes
COMPLETE - All Python patterns validated and working correctly:

1. **Validation Results:**
   - Basic class instantiation: ✅ Works
   - Module-qualified calls: ✅ Works (module.SubClass() detected)
   - Property assignments: ✅ Works (self.data = DataClass() detected)
   - Dataclass with keywords: ✅ Works (correctly counts keyword arguments)
   - Factory methods: ✅ Works (Config.from_dict() detected via bespoke handler)
   - Super calls: ✅ Works (super().__init__() detected via bespoke handler)
   - Metaclass: N/A (class definitions are not constructor calls)

2. **Key Fixes Applied (from previous tasks):**
   - Fixed Python field names in bespoke handlers ('function' instead of 'func', 'attribute' instead of 'attr')
   - Added is_super_call and is_factory_method fields to bespoke handler returns
   - Comprehensive test coverage added in task 11.82.3

3. **Python-Specific Quirks Documented:**
   - Python doesn't have explicit constructor syntax (no 'new' keyword)
   - Relies on capitalization convention to identify constructors
   - super().__init__() is a special pattern handled by bespoke handler
   - Class method factories (from_dict, from_json, etc.) are detected as constructor calls
   - Metaclass usage in class definitions is not a constructor call