# Task epic-11.116.5.2: Verify JavaScript Fixture Coverage for Registry Tests

**Status:** Audit Completed - Major Gaps Identified
**Parent:** task-epic-11.116.5
**Priority:** High
**Created:** 2025-10-15

## Overview

Verify that JavaScript fixtures cover registry integration test scenarios. JavaScript currently has minimal coverage and will likely need significant additions.

## Current JavaScript Fixtures

```
javascript/semantic_index/
├── classes/
│   └── basic_class.json ✅
├── functions/
│   └── basic_functions.json ✅
└── modules/
    └── (empty) ❌
```

**Status:** Very sparse coverage. Missing most integration test scenarios.

## Integration Test Requirements

### 1. Basic Resolution
- [ ] Local function calls → **PARTIAL**: `functions/basic_functions.json` (verify if it includes calls)

### 2. Cross-Module Resolution
- [ ] Imported function calls → **MISSING**: Need CommonJS or ES6 module examples
- [ ] Imported class methods → **MISSING**: Need class + import scenario

### 3. Shadowing Scenarios
- [ ] Local definition shadows import → **MISSING**: Need shadowing example

### 4. Complete Workflows
- [ ] Constructor → type → method chain → **MISSING**: Need workflow example

### 5. Module Systems
JavaScript has TWO module systems that should both be tested:
- [ ] CommonJS (`require`/`module.exports`) → **MISSING**
- [ ] ES6 Modules (`import`/`export`) → **MISSING**

## Tasks

### Step 1: Audit Existing Fixtures (15 min)

Check current fixtures:

| Test Scenario | Required Fixture | Status | Action |
|--------------|-----------------|--------|--------|
| Local function call | `functions/basic_functions.json` | ✅ Exists | Verify includes calls |
| CommonJS imports | `modules/commonjs_*.json` | ❌ Missing | Create |
| ES6 imports | `modules/es6_*.json` | ❌ Missing | Create |
| Class with methods | `classes/methods.json` | ❌ Missing | Create |
| Import class method | `modules/import_class.json` | ❌ Missing | Create |
| Local shadows import | `modules/shadowing.json` | ❌ Missing | Create |
| Constructor workflow | `classes/workflow.json` | ❌ Missing | Create |

### Step 2: Create Missing Code Fixtures (2-3 hours)

**Priority 1: Module Resolution**

```javascript
// javascript/code/modules/utils_commonjs.js
function helper() {
  return "helper";
}

module.exports = { helper };

// javascript/code/modules/main_commonjs.js
const { helper } = require('./utils_commonjs');

helper();
```

```javascript
// javascript/code/modules/utils_es6.js
export function helper() {
  return "helper";
}

// javascript/code/modules/main_es6.js
import { helper } from './utils_es6';

helper();
```

**Priority 2: Class Methods**

```javascript
// javascript/code/classes/methods.js
class Calculator {
  add(a, b) {
    return a + b;
  }

  multiply(a, b) {
    return a * b;
  }
}

const calc = new Calculator();
calc.add(1, 2);
calc.multiply(3, 4);
```

**Priority 3: Cross-Module Classes**

```javascript
// javascript/code/modules/user_class.js
export class User {
  constructor(name) {
    this.name = name;
  }

  getName() {
    return this.name;
  }
}

// javascript/code/modules/uses_user.js
import { User } from './user_class';

const user = new User("Alice");
const name = user.getName();
```

**Priority 4: Shadowing**

```javascript
// javascript/code/modules/shadowing.js
import { helper } from './utils_es6';

// Local function shadows import
function helper() {
  return "local";
}

helper(); // Should resolve to local
```

### Step 3: Generate Semantic Index JSON (1 hour)

```bash
npm run generate-fixtures:js -- javascript/code/modules/utils_commonjs.js
npm run generate-fixtures:js -- javascript/code/modules/main_commonjs.js
npm run generate-fixtures:js -- javascript/code/modules/utils_es6.js
npm run generate-fixtures:js -- javascript/code/modules/main_es6.js
npm run generate-fixtures:js -- javascript/code/classes/methods.js
npm run generate-fixtures:js -- javascript/code/modules/user_class.js
npm run generate-fixtures:js -- javascript/code/modules/uses_user.js
npm run generate-fixtures:js -- javascript/code/modules/shadowing.js
```

### Step 4: Verify Fixtures (30 min)

Check each JSON file for:
- [ ] CommonJS imports captured correctly
- [ ] ES6 imports captured correctly
- [ ] Method definitions in classes
- [ ] Method call references
- [ ] Constructor references
- [ ] Shadowing scope resolution

## Success Criteria

- [ ] JavaScript has module fixtures for both CommonJS and ES6
- [ ] Class method scenarios covered
- [ ] Cross-module class usage covered
- [ ] Shadowing scenarios covered
- [ ] All JSON fixtures validated

## Estimated Effort

**3-4 hours**
- 15 min: Audit existing fixtures
- 2-3 hours: Create missing code fixtures (many needed)
- 1 hour: Generate JSON for all fixtures
- 30 min: Verify and validate

## Deliverables

- [ ] Fixture coverage mapping table
- [ ] New JavaScript code fixtures (CommonJS + ES6 modules)
- [ ] Class method fixtures
- [ ] Generated semantic index JSON files
- [ ] Validation report

## COMPREHENSIVE AUDIT RESULTS

### Audit Findings

**🔍 INTEGRATION TEST SCENARIOS REQUIRED:**
1. **Basic Resolution** - Local function calls
2. **Cross-Module Resolution** - Imported function calls and imported class methods
3. **Shadowing Scenarios** - Local definition shadows import
4. **Complete Workflows** - Constructor → type → method chain
5. **Nested Function Scopes** - Calls at different scope levels
6. **Method and Constructor Calls** - Type-based resolution

### Current JavaScript Coverage Analysis

**✅ EXISTING COVERAGE:**

1. **Basic Resolution** - Local function calls
   - **Status:** ✅ **PARTIAL COVERAGE**
   - **Fixture:** `functions/basic_functions.json`
   - **Code:** `functions/basic_functions.js`
   - **Analysis:** Contains function definitions and call chains (`callChain()` → `fetchData()` → `transformData()`)
   - **Gaps:** No nested function scopes for `enclosing_function_scope_id` testing

2. **Class Definitions and Methods**
   - **Status:** ✅ **BASIC COVERAGE**
   - **Fixture:** `classes/basic_class.json`
   - **Code:** `classes/basic_class.js`
   - **Analysis:** Has class definitions, constructors, methods, and inheritance
   - **Gaps:** No constructor → method workflow in same file

**❌ MAJOR GAPS IDENTIFIED:**

3. **Cross-Module Resolution**
   - **Function imports/calls:** ❌ **MISSING ENTIRELY**
   - **Class method imports:** ❌ **MISSING ENTIRELY**
   - **Module systems:** ❌ **NO MODULE FIXTURES AT ALL**
   - **Impact:** Cannot test core import resolution scenarios

4. **Shadowing Scenarios**
   - **Status:** ❌ **MISSING ENTIRELY**
   - **Required:** Local function shadows imported function
   - **Impact:** Cannot test lexical scope resolution priority

5. **Complete Workflows**
   - **Constructor → type → method chain:** ❌ **MISSING**
   - **Current state:** Has separate class and function examples, but no integrated workflow
   - **Impact:** Cannot test type binding and method resolution chains

6. **Module System Coverage**
   - **CommonJS (`require`/`module.exports`):** ❌ **MISSING**
   - **ES6 Modules (`import`/`export`):** ❌ **MISSING**
   - **Impact:** Cannot test either JavaScript module system

### Coverage Mapping Table

| Integration Test Scenario | Required Fixture | Status | Coverage Level |
|---------------------------|------------------|--------|----------------|
| Local function calls | `functions/basic_functions.json` | ✅ EXISTS | **PARTIAL** - Missing nested scopes |
| Import function calls (CommonJS) | `modules/utils_commonjs.json` + `modules/main_commonjs.json` | ❌ MISSING | **NONE** |
| Import function calls (ES6) | `modules/utils_es6.json` + `modules/main_es6.json` | ❌ MISSING | **NONE** |
| Import class methods | `modules/class_export.json` + `modules/class_import.json` | ❌ MISSING | **NONE** |
| Local shadows import | `modules/shadowing.json` | ❌ MISSING | **NONE** |
| Constructor → type → method | `classes/constructor_workflow.json` | ❌ MISSING | **NONE** |
| Nested function scopes | `functions/nested_scopes.json` | ❌ MISSING | **NONE** |

### Priority Ranking for Missing Fixtures

**🔴 CRITICAL (P1) - Core Integration Test Requirements:**
1. **Cross-module function resolution** (both CommonJS and ES6)
2. **Cross-module class method resolution**
3. **Shadowing scenarios**

**🟡 HIGH (P2) - Complete Test Coverage:**
4. **Constructor → method workflows**
5. **Nested function scopes for enclosing_function_scope_id**

### Fixture Creation Requirements

**MINIMUM VIABLE FIXTURES NEEDED (9 new files):**

**CommonJS Module System:**
- `javascript/code/modules/utils_commonjs.js` - Exported functions
- `javascript/code/modules/main_commonjs.js` - Imports and calls functions

**ES6 Module System:**
- `javascript/code/modules/utils_es6.js` - Exported functions
- `javascript/code/modules/main_es6.js` - Imports and calls functions

**Cross-Module Classes:**
- `javascript/code/modules/user_class.js` - Exported class with methods
- `javascript/code/modules/uses_user.js` - Imports class, creates instance, calls methods

**Shadowing:**
- `javascript/code/modules/shadowing.js` - Imports function but defines local function with same name

**Workflows:**
- `javascript/code/classes/constructor_workflow.js` - Single file with class instantiation and method calls

**Nested Scopes:**
- `javascript/code/functions/nested_scopes.js` - Nested functions for scope testing

### Estimated Effort

**TOTAL: 4-5 hours**
- **Analysis:** ✅ COMPLETED (1 hour)
- **Code fixture creation:** 2-3 hours (9 new files)
- **JSON generation:** 1 hour
- **Validation:** 30 minutes

**RESULT: ❌ CRITICAL GAPS** - JavaScript has the least coverage of all languages and requires substantial fixture creation before registry integration test refactoring can proceed.

## Notes

- JavaScript has the most gaps - expect to create many fixtures
- MUST cover both module systems (CommonJS and ES6)
- Focus on realistic patterns used in Node.js and modern JS
- Consider adding arrow function examples if not in existing fixtures
