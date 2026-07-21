# Task epic-11.116.5.3: Verify Python Fixture Coverage for Registry Tests

**Status:** Audit Completed - Significant Gaps Identified
**Parent:** task-epic-11.116.5
**Priority:** High
**Created:** 2025-10-15

## Overview

Verify that Python fixtures cover registry integration test scenarios. Python has moderate coverage but likely missing some cross-module and method resolution scenarios.

## Current Python Fixtures

```
python/semantic_index/
├── classes/
│   ├── basic_class.json ✅
│   └── inheritance.json ✅
├── functions/
│   └── basic_functions.json ✅
└── modules/
    └── imports.json ✅
```

**Status:** Moderate coverage. Has basics but missing method resolution and workflows.

## Integration Test Requirements

### 1. Basic Resolution
- [ ] Local function calls → **CHECK**: `functions/basic_functions.json` (verify includes calls)

### 2. Cross-Module Resolution
- [ ] Imported function calls → **EXISTS**: `modules/imports.json`
- [ ] Imported class methods → **MISSING**: Need class + import + method call scenario

### 3. Shadowing Scenarios
- [ ] Local definition shadows import → **MISSING**: Need shadowing example

### 4. Complete Workflows
- [ ] Constructor → type → method chain → **MISSING**: Need workflow example

### 5. Python-Specific
- [ ] Class methods (self parameter) → **CHECK**: Verify in `classes/basic_class.json`
- [ ] Static methods (@staticmethod) → **MISSING**: May need to add
- [ ] Class methods (@classmethod) → **MISSING**: May need to add

## Tasks

### Step 1: Audit Existing Fixtures (20 min)

Check current fixtures and map to test scenarios:

| Test Scenario | Required Fixture | Status | Action |
|--------------|-----------------|--------|--------|
| Local function call | `functions/basic_functions.json` | ✅ Exists | Verify includes calls |
| Import function | `modules/imports.json` | ✅ Exists | Verify |
| Class with methods | `classes/basic_class.json` | ✅ Exists | Verify has method calls |
| Import class method | `modules/import_class.json` | ❌ Missing | Create |
| Local shadows import | `modules/shadowing.json` | ❌ Missing | Create |
| Constructor workflow | `classes/workflow.json` | ❌ Missing | Create |
| Method types | `classes/method_types.json` | ❌ Missing | Create if needed |

### Step 2: Create Missing Code Fixtures (1-2 hours)

**Priority 1: Cross-Module Class Methods**

```python
# python/code/classes/user_class.py
class User:
    def __init__(self, name: str):
        self.name = name

    def get_name(self) -> str:
        return self.name

# python/code/modules/uses_user.py
from user_class import User

user = User("Alice")
name = user.get_name()
```

**Priority 2: Shadowing**

```python
# python/code/modules/shadowing.py
from utils import helper

# Local function shadows import
def helper():
    return "local"

# Should resolve to local helper
helper()
```

**Priority 3: Method Workflows**

```python
# python/code/classes/method_workflow.py
class Calculator:
    def __init__(self):
        self.result = 0

    def add(self, x: int) -> 'Calculator':
        self.result += x
        return self

    def multiply(self, x: int) -> 'Calculator':
        self.result *= x
        return self

    def get_result(self) -> int:
        return self.result

calc = Calculator()
result = calc.add(5).multiply(2).get_result()
```

**Priority 4: Method Types (if needed)**

```python
# python/code/classes/method_types.py
class Example:
    def instance_method(self):
        return "instance"

    @classmethod
    def class_method(cls):
        return "class"

    @staticmethod
    def static_method():
        return "static"

obj = Example()
obj.instance_method()
Example.class_method()
Example.static_method()
```

### Step 3: Generate Semantic Index JSON (30 min)

```bash
npm run generate-fixtures:py -- python/code/classes/user_class.py
npm run generate-fixtures:py -- python/code/modules/uses_user.py
npm run generate-fixtures:py -- python/code/modules/shadowing.py
npm run generate-fixtures:py -- python/code/classes/method_workflow.py
npm run generate-fixtures:py -- python/code/classes/method_types.py
```

### Step 4: Verify Python-Specific Features (30 min)

Check that fixtures correctly capture:
- [ ] `self` parameter in methods
- [ ] `__init__` constructors
- [ ] Type hints (if present)
- [ ] Decorators (@staticmethod, @classmethod)
- [ ] Method chaining (fluent interfaces)

## Success Criteria

- [ ] All integration test scenarios have Python fixtures
- [ ] Cross-module class method resolution covered
- [ ] Shadowing scenarios covered
- [ ] Method workflow scenarios covered
- [ ] Python-specific features (decorators, method types) verified
- [ ] All JSON fixtures validated

## Estimated Effort

**2-3 hours**
- 20 min: Audit existing fixtures
- 1-2 hours: Create missing code fixtures
- 30 min: Generate JSON
- 30 min: Verify Python-specific features

## Deliverables

- [ ] Fixture coverage mapping table
- [ ] New Python code fixtures
- [ ] Generated semantic index JSON files
- [ ] Validation report for Python-specific features

## COMPREHENSIVE AUDIT RESULTS

### Audit Findings

**🔍 INTEGRATION TEST SCENARIOS REQUIRED:**
1. **Basic Resolution** - Local function calls
2. **Cross-Module Resolution** - Imported function calls and imported class methods
3. **Shadowing Scenarios** - Local definition shadows import
4. **Complete Workflows** - Constructor → type → method chain
5. **Nested Function Scopes** - Calls at different scope levels
6. **Method and Constructor Calls** - Type-based resolution

### Current Python Coverage Analysis

**✅ EXISTING COVERAGE:**

1. **Basic Resolution** - Local function calls
   - **Status:** ✅ **GOOD COVERAGE**
   - **Fixture:** `functions/basic_functions.json`
   - **Code:** `functions/basic_functions.py`
   - **Analysis:** Contains function definitions and call chains (`call_chain()` → `fetch_data()` → `transform_data()`)
   - **Gaps:** No nested function scopes for `enclosing_function_scope_id` testing

2. **Class Definitions and Methods**
   - **Status:** ✅ **GOOD COVERAGE**
   - **Fixtures:** `classes/basic_class.json`, `classes/inheritance.json`
   - **Code:** `classes/basic_class.py`, `classes/inheritance.py`
   - **Analysis:** Has class definitions, `__init__` constructors, methods, and inheritance with `super()`
   - **Gaps:** No constructor → method workflow in same file

3. **Module Imports (Partial)**
   - **Status:** ⚠️ **LIMITED COVERAGE**
   - **Fixture:** `modules/imports.json`
   - **Code:** `modules/imports.py`
   - **Analysis:** Has standard library imports (`os`, `sys`, `typing`), function definitions that use imported modules
   - **Gaps:** No custom module imports, no cross-file function calls

**❌ MAJOR GAPS IDENTIFIED:**

4. **Cross-Module Resolution**
   - **Custom module imports/calls:** ❌ **MISSING**
   - **Class method imports:** ❌ **MISSING ENTIRELY**
   - **Current state:** Only standard library imports, no custom modules
   - **Impact:** Cannot test core import resolution scenarios

5. **Shadowing Scenarios**
   - **Status:** ❌ **MISSING ENTIRELY**
   - **Required:** Local function shadows imported function
   - **Impact:** Cannot test lexical scope resolution priority

6. **Complete Workflows**
   - **Constructor → type → method chain:** ❌ **MISSING**
   - **Current state:** Has separate class and function examples, but no integrated workflow
   - **Impact:** Cannot test type binding and method resolution chains

### Coverage Mapping Table

| Integration Test Scenario | Required Fixture | Status | Coverage Level |
|---------------------------|------------------|--------|----------------|
| Local function calls | `functions/basic_functions.json` | ✅ EXISTS | **GOOD** - Has call chains |
| Import function calls | `modules/custom_utils.json` + `modules/main_imports.json` | ❌ MISSING | **NONE** |
| Import class methods | `modules/class_module.json` + `modules/uses_class.json` | ❌ MISSING | **NONE** |
| Local shadows import | `modules/shadowing.json` | ❌ MISSING | **NONE** |
| Constructor → type → method | `classes/constructor_workflow.json` | ❌ MISSING | **NONE** |
| Nested function scopes | `functions/nested_scopes.json` | ❌ MISSING | **NONE** |

### Priority Ranking for Missing Fixtures

**🔴 CRITICAL (P1) - Core Integration Test Requirements:**
1. **Cross-module function resolution** (custom modules)
2. **Cross-module class method resolution**
3. **Shadowing scenarios**

**🟡 HIGH (P2) - Complete Test Coverage:**
4. **Constructor → method workflows**
5. **Nested function scopes for enclosing_function_scope_id**

### Fixture Creation Requirements

**MINIMUM VIABLE FIXTURES NEEDED (6 new files):**

**Custom Module System:**
- `python/code/modules/utils.py` - Module with exported functions
- `python/code/modules/main.py` - Imports and calls functions from utils

**Cross-Module Classes:**
- `python/code/modules/user_class.py` - Module with class definition and methods
- `python/code/modules/uses_user.py` - Imports class, creates instance, calls methods

**Shadowing:**
- `python/code/modules/shadowing.py` - Imports function but defines local function with same name

**Workflows:**
- `python/code/classes/constructor_workflow.py` - Single file with class instantiation and method calls

**Nested Scopes:**
- `python/code/functions/nested_scopes.py` - Nested functions for scope testing

### Python-Specific Considerations

**✅ WELL COVERED:**
- Class method syntax with `self` parameter
- `__init__` constructors
- Inheritance with `super()`
- Type hints (`-> str`, `List[str]`, etc.)

**🔍 TO VERIFY IN NEW FIXTURES:**
- Method decorators (`@staticmethod`, `@classmethod`, `@property`)
- Dataclass support (if relevant)
- Method chaining patterns
- `from module import function` vs `import module` patterns

### Estimated Effort

**TOTAL: 3 hours**
- **Analysis:** ✅ COMPLETED (30 minutes)
- **Code fixture creation:** 1.5-2 hours (6 new files)
- **JSON generation:** 30 minutes
- **Validation:** 30 minutes

**RESULT: ⚠️ SIGNIFICANT GAPS** - Python has better foundation than JavaScript but still missing critical cross-module scenarios needed for integration tests.

## Notes

- Python's class method syntax is different from TS/JS (self vs this)
- Check that decorators are captured correctly
- Type hints should be in type bindings
- Method chaining is common in Python - good to test
- Consider dataclasses if they're a common pattern
