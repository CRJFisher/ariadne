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
p = Person("Alice")  # ✅ Works

# Module qualified
obj = module.SubClass()  # ❌ Not detected

# Property assignment  
self.data = DataClass()  # ❌ Not tracked as type assignment

# Dataclass with keywords
user = User(name="Bob", age=30)  # ⚠️ Partially works

# Factory methods
config = Config.from_dict(data)  # ⚠️ Needs validation

# Super calls
super().__init__(args)  # ✅ Works via bespoke

# Metaclass
class Meta(type): pass
class MyClass(metaclass=Meta): pass  # ❌ Not detected
```

## Acceptance Criteria
- [ ] Detect module-qualified constructor calls
- [ ] Track self/cls property assignments as type info
- [ ] Properly count keyword arguments
- [ ] Detect @classmethod factory patterns
- [ ] Handle metaclass instantiation
- [ ] Add comprehensive test coverage for all patterns
- [ ] Document Python-specific quirks

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