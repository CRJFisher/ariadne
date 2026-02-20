# Task Epic 11.154: Standardize and Validate Query Capture Schemas Across Languages

**Status**: Pending
**Priority**: High
**Complexity**: High
**Time Estimate**: 18 days (3.5 weeks)

**Supersedes**: Previous 11.154 (Fix Duplicate Method Call References) - See [TASK-11.154-OVERHAUL-SUMMARY.md](TASK-11.154-OVERHAUL-SUMMARY.md)

---

## Subtasks

This task is broken into 8 subtasks for manageable execution:

1. **[Task 11.154.1](task-epic-11.154.1-Document-Current-Capture-State.md)** - Document Current Capture State (1 day)
   - Inventory all captures across languages
   - Identify duplicates and inconsistencies
   - Map to semantic model

2. **[Task 11.154.2](task-epic-11.154.2-Design-Canonical-Capture-Schema.md)** - Design Canonical Capture Schema (2 days)
   - Define required, optional, prohibited patterns
   - Create validation schema
   - Write user documentation

3. **[Task 11.154.3](task-epic-11.154.3-Implement-Validation-Infrastructure.md)** - Implement Validation Infrastructure (3 days)
   - Build validation script
   - Create test suite
   - Integrate with CI

4. **[Task 11.154.4](task-epic-11.154.4-Fix-TypeScript-Query-Captures.md)** - Fix TypeScript Query Captures (2 days)
   - Remove duplicate method call captures
   - Conform to schema
   - Validate and test

5. **[Task 11.154.5](task-epic-11.154.5-Fix-JavaScript-Query-Captures.md)** - Fix JavaScript Query Captures (1 day)
   - Apply TypeScript patterns
   - Validate and test

6. **[Task 11.154.6](task-epic-11.154.6-Fix-Python-Query-Captures.md)** - Fix Python Query Captures (2 days)
   - Handle Python-specific AST nodes
   - Validate and test

7. **[Task 11.154.7](task-epic-11.154.7-Fix-Rust-Query-Captures.md)** - Fix Rust Query Captures (2 days)
   - Handle both `.` and `::` call syntax
   - Validate and test

8. **[Task 11.154.8](task-epic-11.154.8-Final-Integration-and-Documentation.md)** - Final Integration and Documentation (2 days)
   - Update reference builder
   - Verify entry point detection
   - Complete documentation

### Total Time

15 days implementation + 3 days buffer = **18 days (3.5 weeks)**

---

## Problem Statement

### Immediate Issue: Duplicate Captures Cause False Negative Entry Points

The entry point detection system produces false negatives because tree-sitter query files create **duplicate captures** for method calls. For example, `this.definitions.update_file()` creates TWO captures:

1. `@reference.call` on the `property_identifier` node ("update_file")
2. `@reference.call.full` on the entire `call_expression` node

The first capture gets incorrectly classified as a `FUNCTION_CALL` instead of `METHOD_CALL`, creating a false self-reference that excludes legitimate entry points like `Project.update_file` from detection.

**Affected methods** (from [api_missing_from_detection.json](../../../../top-level-nodes-analysis/results/api_missing_from_detection.json)):
- `Project.update_file` (line 156)
- `Project.remove_file` (line 306)
- `Project.get_dependents` (line 455)
- `Project.clear` (line 554)

### Root Cause: Inconsistent and Redundant Capture Patterns

**Deeper analysis reveals systemic issues:**

1. **No uniform capture schema** - Each language evolved independently:
   - TypeScript: 118 unique captures
   - JavaScript: 79 unique captures
   - Python: 79 unique captures
   - Rust: 117 unique captures

2. **Duplicate/redundant captures** across all languages:
   - `@reference.call` + `@reference.call.full`
   - `@reference.call.chained` + parent captures
   - `@reference.call.deep` + parent captures

3. **No validation** - Nothing enforces consistency when:
   - Adding new languages
   - Modifying existing patterns
   - Ensuring semantic category/entity alignment

4. **Unclear intent** - The capture naming convention exists (`@category.entity.qualifier`), but:
   - Not documented
   - Not enforced
   - Not tested

---

## Solution Strategy

### Phase 1: Design Canonical Capture Schema

Create a **language-agnostic capture schema** that defines:

1. **Required captures** - Every language MUST have these
2. **Optional captures** - Language-specific features
3. **Prohibited patterns** - Known problematic patterns (like duplicate method calls)

The schema should map directly to our semantic model:

```typescript
SemanticCategory:
  - SCOPE
  - DEFINITION
  - REFERENCE
  - IMPORT
  - EXPORT
  - TYPE
  - ASSIGNMENT
  - RETURN
  - DECORATOR
  - MODIFIER

SemanticEntity:
  - MODULE, CLASS, FUNCTION, METHOD, CONSTRUCTOR, BLOCK, CLOSURE
  - INTERFACE, ENUM, NAMESPACE
  - VARIABLE, CONSTANT, PARAMETER, FIELD, PROPERTY
  - TYPE_PARAMETER, ENUM_MEMBER
  - TYPE_ALIAS, IMPORT, CALL, SUPER, ...
```

**Capture naming convention:**
```
@{category}.{entity}[.{qualifier}]

Examples:
  @definition.class         - Class definition
  @reference.call           - Function/method call (ONE capture, not multiple)
  @scope.function.body      - Function body scope
```

### Phase 2: Eliminate Duplicate Captures

**For method calls specifically:**

**Current (problematic):**
```scheme
; TypeScript/JavaScript
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier) @reference.call    ; DUPLICATE 1
  )
) @reference.call.full                                 ; DUPLICATE 2
```

**Proposed (clean):**
```scheme
; TypeScript/JavaScript
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call                                      ; SINGLE CAPTURE

; Rely on extractors to get method name from call_expression
```

**Benefits:**
- One capture per syntactic construct
- `extract_call_name()` handles name extraction
- `is_method_call()` determines call type
- No ambiguity in `determine_reference_kind()`

**Apply same pattern to:**
- Chained calls (`a.b.c()`)
- Deep calls (`a.b.c.d()`)
- Constructor calls
- All four languages

### Phase 3: Create Validation Infrastructure

#### 3.1 Capture Schema Definition

Create `packages/core/src/index_single_file/query_code_tree/capture_schema.ts`:

```typescript
/**
 * Canonical capture schema for all languages
 */
export interface CaptureSchema {
  /** Required captures - every language MUST have these */
  required: CapturePattern[];

  /** Optional captures - language-specific features */
  optional: CapturePattern[];

  /** Prohibited patterns - known problematic captures */
  prohibited: ProhibitedPattern[];
}

export interface CapturePattern {
  /** Capture name pattern (regex) */
  pattern: RegExp;

  /** Human-readable description */
  description: string;

  /** Semantic category this maps to */
  category: SemanticCategory;

  /** Semantic entity this maps to */
  entity: SemanticEntity;

  /** Example usage */
  example: string;
}

export interface ProhibitedPattern {
  /** Pattern to detect */
  pattern: RegExp;

  /** Why it's prohibited */
  reason: string;

  /** What to use instead */
  alternative: string;
}

export const CANONICAL_CAPTURE_SCHEMA: CaptureSchema = {
  required: [
    {
      pattern: /^@definition\.(class|function|method|variable)$/,
      description: "Core definition captures",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS, // or FUNCTION, METHOD, VARIABLE
      example: "@definition.function"
    },
    {
      pattern: /^@reference\.call$/,
      description: "Function/method calls - SINGLE capture on call_expression",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "@reference.call"
    },
    // ... more required patterns
  ],

  prohibited: [
    {
      pattern: /^@reference\.call\.(full|chained|deep)$/,
      reason: "Creates duplicate captures for same method call",
      alternative: "Use single @reference.call on call_expression, extract name via metadata extractors"
    },
    {
      pattern: /^@[^.]+\.[^.]+\.[^.]+\.[^.]+$/,
      reason: "More than 3 levels of nesting indicates over-granular captures",
      alternative: "Simplify to @category.entity.qualifier"
    },
    // ... more prohibited patterns
  ],

  optional: [
    {
      pattern: /^@definition\.decorator$/,
      description: "Python/TypeScript decorators",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.METHOD, // or CLASS, PROPERTY
      example: "@definition.decorator"
    },
    // ... language-specific patterns
  ]
};
```

#### 3.2 Validation Script

Create `packages/core/src/index_single_file/query_code_tree/validate_captures.ts`:

```typescript
/**
 * Validates that all .scm files conform to canonical capture schema
 */
export interface ValidationResult {
  file: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: CaptureStats;
}

export interface ValidationError {
  line: number;
  capture: string;
  reason: string;
  fix?: string;
}

export interface ValidationWarning {
  line: number;
  capture: string;
  message: string;
}

export interface CaptureStats {
  total_captures: number;
  unique_captures: number;
  by_category: Record<string, number>;
  by_entity: Record<string, number>;
}

/**
 * Validate a single .scm file
 */
export function validate_scm_file(
  file_path: string,
  schema: CaptureSchema
): ValidationResult {
  const content = fs.readFileSync(file_path, 'utf-8');
  const lines = content.split('\n');

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const captures = extract_captures(content);

  // Check for prohibited patterns
  for (const capture of captures) {
    for (const prohibited of schema.prohibited) {
      if (prohibited.pattern.test(capture.name)) {
        errors.push({
          line: capture.line,
          capture: capture.name,
          reason: prohibited.reason,
          fix: prohibited.alternative
        });
      }
    }
  }

  // Check for required patterns
  const capture_names = new Set(captures.map(c => c.name));
  for (const required of schema.required) {
    const has_match = Array.from(capture_names).some(name =>
      required.pattern.test(name)
    );
    if (!has_match) {
      errors.push({
        line: 0,
        capture: required.pattern.source,
        reason: `Missing required capture: ${required.description}`,
        fix: required.example
      });
    }
  }

  // Collect stats
  const stats = collect_stats(captures);

  return {
    file: file_path,
    errors,
    warnings,
    stats
  };
}

/**
 * Validate all language query files
 */
export function validate_all_languages(): ValidationResult[] {
  const languages = ['typescript', 'javascript', 'python', 'rust'];
  const results: ValidationResult[] = [];

  for (const lang of languages) {
    const file_path = `queries/${lang}.scm`;
    const result = validate_scm_file(file_path, CANONICAL_CAPTURE_SCHEMA);
    results.push(result);
  }

  return results;
}
```

#### 3.3 Test Infrastructure

Create `packages/core/src/index_single_file/query_code_tree/validate_captures.test.ts`:

```typescript
describe("Capture Schema Validation", () => {
  describe("TypeScript queries", () => {
    it("should have no prohibited patterns", () => {
      const result = validate_scm_file("queries/typescript.scm", CANONICAL_CAPTURE_SCHEMA);
      expect(result.errors).toHaveLength(0);
    });

    it("should have all required captures", () => {
      const result = validate_scm_file("queries/typescript.scm", CANONICAL_CAPTURE_SCHEMA);
      const required_errors = result.errors.filter(e => e.reason.includes("Missing required"));
      expect(required_errors).toHaveLength(0);
    });

    it("should not have duplicate method call captures", () => {
      const result = validate_scm_file("queries/typescript.scm", CANONICAL_CAPTURE_SCHEMA);
      const duplicate_errors = result.errors.filter(e =>
        e.capture.match(/@reference\.call\.(full|chained|deep)/)
      );
      expect(duplicate_errors).toHaveLength(0);
    });
  });

  // Repeat for JavaScript, Python, Rust

  describe("Cross-language consistency", () => {
    it("should have similar capture counts across similar languages", () => {
      const ts_result = validate_scm_file("queries/typescript.scm", CANONICAL_CAPTURE_SCHEMA);
      const js_result = validate_scm_file("queries/javascript.scm", CANONICAL_CAPTURE_SCHEMA);

      // TS and JS should have similar capture counts (TS might have more for types)
      const diff = Math.abs(ts_result.stats.total_captures - js_result.stats.total_captures);
      expect(diff).toBeLessThan(50); // Allow some variance
    });

    it("should use consistent naming across languages", () => {
      const all_results = validate_all_languages();

      // All should have @reference.call
      for (const result of all_results) {
        const has_call = result.stats.by_entity['call'] > 0;
        expect(has_call).toBe(true);
      }
    });
  });
});
```

#### 3.4 CI Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Validate query captures
  run: npm run validate:captures
```

Add to `package.json`:

```json
{
  "scripts": {
    "validate:captures": "tsx packages/core/src/index_single_file/query_code_tree/validate_captures.ts"
  }
}
```

---

## Implementation Plan

### Step 1: Document Current State (1 day)

**Files to create:**
- `backlog/tasks/epics/epic-11-codebase-restructuring/CAPTURE-SCHEMA-ANALYSIS.md`

**Content:**
- Full inventory of captures per language (the 118, 79, 79, 117 breakdown)
- Identify all duplicate patterns
- Map captures to SemanticCategory/Entity
- Document language-specific captures

### Step 2: Design Canonical Schema (2 days)

**Files to create:**
- `packages/core/src/index_single_file/query_code_tree/capture_schema.ts`
- `packages/core/docs/CAPTURE-SCHEMA.md` (user-facing docs)

**Design decisions:**
- Which captures are truly required?
- Which are optional/language-specific?
- How to handle language differences (e.g., Python attributes vs TS properties)?
- What qualifiers are allowed? (`.full`, `.chained`, `.optional`, etc.)

**Review with stakeholders before proceeding**

### Step 3: Implement Validation Infrastructure (3 days)

**Files to create:**
- `packages/core/src/index_single_file/query_code_tree/validate_captures.ts`
- `packages/core/src/index_single_file/query_code_tree/validate_captures.test.ts`

**Implementation:**
- Schema parser
- Validation logic
- Error reporting with line numbers and fixes
- Stats collection
- Test suite

### Step 4: Run Initial Validation (1 day)

**Action:**
- Run validator on all current .scm files
- Document all errors and warnings
- Prioritize fixes by impact

**Expected output:**
- Validation report showing all schema violations
- List of prohibited patterns found
- Missing required patterns

### Step 5: Fix TypeScript Queries (2 days)

**File:** `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

**Changes:**
1. Remove `@reference.call.full`, `@reference.call.chained`, `@reference.call.deep`
2. Use single `@reference.call` on `call_expression` only
3. Update all method call patterns
4. Ensure `extract_call_name()` handles all cases

**Testing:**
- Run TypeScript semantic index tests
- Verify Project entry points are detected
- Check reference resolution

### Step 6: Fix JavaScript Queries (1 day)

**File:** `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`

**Changes:** Same as TypeScript

**Testing:** Same as TypeScript

### Step 7: Fix Python Queries (2 days)

**File:** `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

**Changes:**
1. Remove `@reference.call.full`, `@reference.call.chained`, `@reference.call.deep`
2. Use single `@reference.call` on `call` node
3. Handle `attribute` nodes for method calls

**Python-specific considerations:**
- `attribute` vs `identifier` naming
- `call` vs `call_expression` node types

**Testing:**
- Run Python semantic index tests
- Verify method call detection
- Check class/instance method differentiation

### Step 8: Fix Rust Queries (2 days)

**File:** `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

**Changes:**
1. Standardize field method calls
2. Remove duplicate associated function captures
3. Handle both `::` and `.` call syntax

**Rust-specific considerations:**
- Associated functions vs methods
- Trait method calls
- Field expressions

**Testing:**
- Run Rust semantic index tests
- Verify method resolution
- Check associated function calls

### Step 9: Update Reference Builder (1 day)

**File:** `packages/core/src/index_single_file/references/reference_builder.ts`

**Changes:**
- Remove need for parent context checking (since we fixed queries)
- Simplify `determine_reference_kind()` logic
- Ensure `extract_call_name()` is always called for method names
- Update comments explaining the new capture strategy

**Note:** This is SIMPLER than Option A in original task because we fixed the queries.

### Step 10: Validation and Integration (2 days)

**Actions:**
1. Run full test suite
2. Re-run entry point analysis on Project class
3. Verify all 4 false negatives are now detected
4. Run validation script - should show 0 errors
5. Update documentation

### Step 11: CI Integration and Enforcement (1 day)

**Actions:**
1. Add validation to CI pipeline
2. Add pre-commit hook (optional)
3. Document process for adding new languages
4. Create template .scm file for new languages

---

## Acceptance Criteria

### Phase 1: Schema Design
- [ ] Canonical capture schema defined in `capture_schema.ts`
- [ ] Schema maps to all `SemanticCategory` and `SemanticEntity` values
- [ ] Required, optional, and prohibited patterns documented
- [ ] User-facing documentation in `CAPTURE-SCHEMA.md`

### Phase 2: Validation Infrastructure
- [ ] Validation script can parse all .scm files
- [ ] Detects prohibited patterns (duplicate captures)
- [ ] Checks for missing required patterns
- [ ] Reports errors with line numbers and fixes
- [ ] Collects meaningful stats
- [ ] Test coverage >90%

### Phase 3: Query File Fixes
- [ ] **TypeScript**: No duplicate method call captures, all tests pass
- [ ] **JavaScript**: No duplicate method call captures, all tests pass
- [ ] **Python**: No duplicate method call captures, all tests pass
- [ ] **Rust**: No duplicate method call captures, all tests pass
- [ ] All semantic index tests pass
- [ ] Validation script reports 0 errors for all languages

### Phase 4: Entry Point Detection Fix
- [ ] `Project.update_file` detected as entry point
- [ ] `Project.remove_file` detected as entry point
- [ ] `Project.get_dependents` detected as entry point
- [ ] `Project.clear` detected as entry point
- [ ] Entry point detection accuracy 100% for Project API
- [ ] No false self-references in any language

### Phase 5: Infrastructure
- [ ] CI validates captures on every commit
- [ ] Documentation explains capture naming convention
- [ ] Template .scm file exists for new languages
- [ ] Process documented for adding language support

---

## Benefits

### Immediate
- **Fixes entry point detection bug** - All 4 false negatives resolved
- **Cleaner query files** - Remove redundant captures
- **Simpler processing** - One capture per construct

### Long-term
- **Consistency** - All languages follow same schema
- **Maintainability** - Clear rules for adding captures
- **Quality** - Validation prevents regressions
- **Onboarding** - Easy to add new languages
- **Debugging** - Clear mapping from captures to semantic model

---

## Risks and Mitigations

### Risk 1: Breaking Changes
**Risk:** Removing captures might break existing code
**Mitigation:**
- Comprehensive test coverage before changes
- Change one language at a time
- Validate semantic index output matches before/after

### Risk 2: Schema Too Restrictive
**Risk:** Canonical schema doesn't accommodate valid language-specific patterns
**Mitigation:**
- Design schema with "optional" category
- Allow language-specific qualifiers
- Review with team before implementing

### Risk 3: Performance
**Risk:** Validation adds overhead to CI
**Mitigation:**
- Validation is fast (regex on text files)
- Can cache results
- Only run on .scm file changes

---

## Related Issues

- **Original issue**: False negative entry points in call graph detection
- **Task 155** (mentioned in analysis): Built-in type method handling (separate issue)
- **Task Epic 11.140**: Call graph detection improvements
- **Task Epic 11.136**: Method call type tracking

---

## Implementation Time Estimate

- **Phase 1 (Documentation)**: 1 day
- **Phase 2 (Schema Design)**: 2 days
- **Phase 3 (Validation Infrastructure)**: 3 days
- **Phase 4 (Initial Validation)**: 1 day
- **Phase 5-8 (Fix Query Files)**: 7 days (2+1+2+2)
- **Phase 9 (Update Reference Builder)**: 1 day
- **Phase 10 (Validation/Integration)**: 2 days
- **Phase 11 (CI Integration)**: 1 day

**Total: 18 days (3.5 weeks)**

---

## Success Metrics

- Zero prohibited capture patterns across all languages
- 100% entry point detection accuracy for Project API
- <5% difference in capture counts between similar languages (TS/JS)
- All validation tests passing
- CI validates captures on every commit

---

## Follow-up Tasks

After this task:
- **Task 155**: Handle built-in type method collisions (Map.clear vs Project.clear)
- **Task 11.155**: Add capture schema validation for new Zig language support
- **Task 11.156**: Optimize capture processing performance with schema knowledge
