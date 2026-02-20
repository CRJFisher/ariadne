# Task epic-11.116.5.1: Verify TypeScript Fixture Coverage for Registry Tests

**Status:** Completed
**Parent:** task-epic-11.116.5
**Priority:** High
**Created:** 2025-10-15

## Overview

Verify that existing TypeScript fixtures cover all scenarios tested in the registry integration tests. Add any missing code fixtures and generate their semantic index JSON files.

## Current TypeScript Fixtures

```
typescript/semantic_index/
├── classes/
│   ├── basic_class.json ✅
│   ├── inheritance.json ✅
│   ├── methods.json ✅
│   └── properties.json ✅
├── functions/
│   ├── arrow_functions.json ✅
│   ├── async_functions.json ✅
│   ├── basic_functions.json ✅
│   ├── call_chains.json ✅
│   └── recursive.json ✅
├── modules/
│   ├── exports.json ✅
│   └── imports.json ✅
├── generics/
│   ├── generic_classes.json ✅
│   └── generic_functions.json ✅
├── interfaces/
│   ├── basic_interface.json ✅
│   └── extends.json ✅
└── types/
    ├── type_aliases.json ✅
    └── unions.json ✅
```

## Integration Test Requirements

Review `symbol_resolution.integration.test.ts` to identify required scenarios:

### 1. Basic Resolution
- [ ] Local function calls → **EXISTS**: `functions/call_chains.json`

### 2. Cross-Module Resolution
- [ ] Imported function calls → **EXISTS**: `modules/imports.json` + `modules/exports.json`
- [ ] Imported class methods → **CHECK**: Do we have a pair of files where one imports and calls a method from another?

### 3. Shadowing Scenarios
- [ ] Local definition shadows import → **MISSING**: Need `modules/shadowing.json`

### 4. Complete Workflows
- [ ] Constructor → type → method chain → **CHECK**: Need to verify or create
  - File with class definition (User class with constructor and getName method)
  - File that imports User, instantiates it, and calls methods

### 5. Enclosing Function Scope
- [ ] Nested function calls → **EXISTS**: `functions/call_chains.json` (verify)
- [ ] Top-level calls → **EXISTS**: Most fixtures
- [ ] Method/constructor calls → **EXISTS**: `classes/methods.json` (verify)

## Tasks

### Step 1: Audit Existing Fixtures (30 min)

For each integration test scenario, check if we have matching fixtures:

```bash
# Read the integration test and map to fixtures
# Check what code scenarios are actually tested
```

Create mapping table:

| Test Scenario | Required Fixture | Status | Action |
|--------------|-----------------|--------|--------|
| Local function call | `functions/call_chains.json` | ✅ Exists | Verify |
| Import function call | `modules/imports.json` | ✅ Exists | Verify |
| Import class method | `modules/???` | ❓ Check | Create if missing |
| Local shadows import | `modules/shadowing.json` | ❌ Missing | Create |
| Constructor workflow | `classes/???` | ❓ Check | Create if missing |
| Nested function calls | `functions/call_chains.json` | ✅ Exists | Verify |

### Step 2: Create Missing Code Fixtures (1-2 hours)

For each missing scenario, create the TypeScript source files:

**Example: Shadowing Scenario**
```typescript
// typescript/code/modules/shadowing.ts
import { helper } from './exports';

// Local function shadows the import
function helper() {
  return "local";
}

// This should resolve to local helper, not imported one
helper();
```

**Example: Constructor Workflow**
```typescript
// typescript/code/classes/user_class.ts
export class User {
  constructor(private name: string) {}

  getName(): string {
    return this.name;
  }
}

// typescript/code/classes/uses_user.ts
import { User } from './user_class';

const user = new User("Alice");
const name = user.getName();
```

### Step 3: Generate Semantic Index JSON (30 min)

For each new code fixture, generate the JSON:

```bash
npm run generate-fixtures:ts -- typescript/code/modules/shadowing.ts
npm run generate-fixtures:ts -- typescript/code/classes/user_class.ts
npm run generate-fixtures:ts -- typescript/code/classes/uses_user.ts
```

### Step 4: Verify Fixtures (30 min)

Ensure generated JSON files contain:
- Correct definitions (functions, classes, methods)
- Correct references (calls, type references)
- Correct scopes
- Correct imports/exports

## Success Criteria

- [x] All integration test scenarios have corresponding fixtures
- [x] Fixture mapping table completed
- [x] New code fixtures created and committed
- [x] Semantic index JSON generated for all new fixtures
- [x] All JSON fixtures validated

## Estimated Effort

**2-3 hours**
- 30 min: Audit existing fixtures
- 1-2 hours: Create missing code fixtures
- 30 min: Generate JSON
- 30 min: Verify

## Deliverables

- [x] Fixture coverage mapping table
- [x] New TypeScript code fixtures (6 new files)
- [x] Generated semantic index JSON files (6 new JSON fixtures)
- [x] Documentation of fixture → test scenario mapping

## COMPLETED AUDIT RESULTS

### Audit Findings

**✅ EXISTING COVERAGE:**
1. **Basic Resolution** - Local function calls within a single file
   - Covered by: `functions/call_chains.json`
   - Has: Function definitions and calls in same file

2. **Cross-module function imports/calls**
   - Covered by: `modules/exports.json` + `modules/imports.json`
   - Has: Function exports and imports with calls

**❌ MISSING COVERAGE:**

3. **Cross-module class methods**: Integration tests expect:
   - `types.ts`: Exported class with methods like `User.getName()`
   - `main.ts`: Imports User, creates instance, calls methods
   - Current state: We have basic classes and basic imports, but no cross-module class usage

4. **Shadowing scenarios**: Integration tests expect:
   - `utils.ts`: Exported function `helper()`
   - `main.ts`: Imports `helper` but also defines local `helper()` function
   - Test verifies local definition shadows the import
   - Current state: No shadowing examples exist

5. **Constructor → type → method chain**: Integration tests expect:
   - Single file with class definition
   - Constructor call creating instance with type binding
   - Method call on that instance
   - Current state: Have class definitions and method definitions separately, but no constructor-to-method workflow

6. **Nested function scopes**: Integration tests expect:
   - Nested functions at different scope levels
   - Calls from different scope levels to test `enclosing_function_scope_id`
   - Current state: Functions exist but no nested scope scenarios

### Created Fixtures

**NEW CODE FIXTURES:**
- `typescript/code/integration/types.ts` - Exported User class with methods
- `typescript/code/integration/main_uses_types.ts` - Imports and uses User class
- `typescript/code/integration/utils.ts` - Exported helper function for shadowing test
- `typescript/code/integration/main_shadowing.ts` - Imports helper but defines local helper
- `typescript/code/integration/constructor_method_chain.ts` - Single file constructor → method workflow
- `typescript/code/integration/nested_scopes.ts` - Nested functions for scope testing

**GENERATED JSON FIXTURES:**
- `typescript/semantic_index/integration/types.json`
- `typescript/semantic_index/integration/main_uses_types.json`
- `typescript/semantic_index/integration/utils.json`
- `typescript/semantic_index/integration/main_shadowing.json`
- `typescript/semantic_index/integration/constructor_method_chain.json`
- `typescript/semantic_index/integration/nested_scopes.json`

### Coverage Verification

| Integration Test Scenario | Required Fixture | Status | Coverage |
|--------------------------|-----------------|--------|----------|
| Local function call | `functions/call_chains.json` | ✅ Exists | Complete |
| Import function call | `modules/exports.json` + `modules/imports.json` | ✅ Exists | Complete |
| Import class method | `integration/types.json` + `integration/main_uses_types.json` | ✅ Created | Complete |
| Local shadows import | `integration/utils.json` + `integration/main_shadowing.json` | ✅ Created | Complete |
| Constructor → type → method | `integration/constructor_method_chain.json` | ✅ Created | Complete |
| Nested function scopes | `integration/nested_scopes.json` | ✅ Created | Complete |

**RESULT: ✅ COMPLETE COVERAGE** - All TypeScript integration test scenarios now have corresponding fixtures.

### JSON Fixture Validation

Verified that generated JSON fixtures contain:
- ✅ Correct definitions (functions, classes, methods, constructors)
- ✅ Correct references (function calls, method calls, constructor calls)
- ✅ Correct scopes (module, class, function, nested function)
- ✅ Correct imports/exports
- ✅ Correct type bindings for constructor → method chains
- ✅ Proper scope hierarchy for nested function scenarios

### Test Status

Integration tests currently fail due to existing registry API compatibility issues (missing methods like `get_exportable_definitions_in_file`, `get_member_index`, `get_symbol_at_location`), but these are unrelated to fixture coverage. The fixtures themselves are correctly generated and contain all required semantic information.

## Notes

- TypeScript has the best coverage, so gaps should be minimal
- Focus on cross-file scenarios (imports, method calls)
- Shadowing scenarios are likely missing
- Constructor workflows may need dedicated fixtures
