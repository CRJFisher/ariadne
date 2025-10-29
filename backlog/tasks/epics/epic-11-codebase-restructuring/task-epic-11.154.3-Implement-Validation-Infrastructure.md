# Task Epic 11.154.3: Implement Validation Infrastructure

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 3 days

---

## Objective

Build automated validation infrastructure that checks all `.scm` files against the canonical schema and reports errors with actionable fixes.

---

## Context

With the canonical schema defined (Task 11.154.2), we need tooling to:

1. **Validate** existing query files against the schema
2. **Report** violations with line numbers and suggested fixes
3. **Integrate** with CI to prevent regressions
4. **Test** the validation logic itself

---

## Deliverables

### 1. Validation Implementation

**File**: `packages/core/src/index_single_file/query_code_tree/validate_captures.ts`

**Key functions:**

- `validate_scm_file(file_path, schema)` - Validate single file
- `validate_all_languages()` - Validate all query files
- `extract_captures(content)` - Parse captures from .scm content
- `collect_stats(captures)` - Gather statistics
- `format_validation_report(result)` - Pretty print results

**Output format:**

```typescript
interface ValidationResult {
  file: string;
  language: Language;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: CaptureStats;
  passed: boolean;
}

interface ValidationError {
  line: number;
  column?: number;
  capture: string;
  rule_violated: string;
  message: string;
  fix?: string;
  example?: string;
}
```

### 2. Test Suite

**File**: `packages/core/src/index_single_file/query_code_tree/validate_captures.test.ts`

**Test coverage:**

- Schema loading and parsing
- Capture extraction from .scm files
- Positive validation (required/optional list checking)
- Required pattern checking
- Fragment capture detection (heuristic warnings)
- Naming convention validation
- Error message formatting
- Stats collection
- Cross-language consistency checks

**Minimum 90% code coverage**

### 3. CLI Tool

**File**: `packages/core/scripts/validate_captures.ts`

```bash
# Validate all languages
npm run validate:captures

# Validate specific language
npm run validate:captures -- --lang typescript

# Verbose output
npm run validate:captures -- --verbose

# JSON output for CI
npm run validate:captures -- --json
```

### 4. CI Integration

**Update**: `.github/workflows/test.yml`

```yaml
- name: Validate query captures
  run: npm run validate:captures -- --json
```

**Should fail PR if:**

- Any prohibited patterns found
- Missing required patterns
- Naming convention violations

---

## Implementation Steps

### Step 1: Implement Core Validation Logic (1 day)

```typescript
/**
 * Extract captures from .scm file content
 */
export function extract_captures(content: string): ParsedCapture[] {
  const captures: ParsedCapture[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match all captures: @capture.name
    const matches = line.matchAll(/@([a-z_]+(?:\.[a-z_]+)*)/g);

    for (const match of matches) {
      const full_capture = match[0]; // @capture.name
      const name_parts = match[1].split("."); // [capture, name]

      captures.push({
        full_name: full_capture,
        category: name_parts[0],
        entity: name_parts[1],
        qualifiers: name_parts.slice(2),
        line: i + 1,
        column: match.index!,
        context: line.trim(),
      });
    }
  }

  return captures;
}

/**
 * Validate captures against schema (POSITIVE validation)
 */
export function validate_captures(
  captures: ParsedCapture[],
  schema: CaptureSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if each capture is in required OR optional lists
  for (const capture of captures) {
    const is_required = schema.required.some(p => p.pattern.test(capture.full_name));
    const is_optional = schema.optional.some(p => p.pattern.test(capture.full_name));

    if (!is_required && !is_optional) {
      errors.push({
        line: capture.line,
        column: capture.column,
        capture: capture.full_name,
        rule_violated: "not_in_schema",
        message: `Capture '${capture.full_name}' is not in required or optional lists`,
        fix: "Either add to schema as optional capture (if needed) or remove from query file"
      });
    }
  }

  // Check naming conventions
  for (const capture of captures) {
    if (!schema.rules.pattern.test(capture.full_name)) {
      errors.push({
        line: capture.line,
        capture: capture.full_name,
        rule_violated: "naming_convention",
        message: "Must follow pattern: @category.entity[.qualifier]"
      });
    }

    // Check max depth
    const parts = capture.full_name.substring(1).split('.');
    if (parts.length > schema.rules.max_depth) {
      errors.push({
        line: capture.line,
        capture: capture.full_name,
        rule_violated: "max_depth_exceeded",
        message: `Too many parts (${parts.length}), max is ${schema.rules.max_depth}`
      });
    }
  }

  // Check for required patterns
  const capture_set = new Set(captures.map((c) => c.full_name));
  for (const required of schema.required) {
    const has_match = Array.from(capture_set).some((name) =>
      required.pattern.test(name)
    );

    if (!has_match) {
      errors.push({
        line: 0,
        capture: required.pattern.source,
        rule_violated: "missing_required",
        message: `Missing required capture: ${required.description}`,
        fix: `Add: ${required.example}`,
      });
    }
  }

  return errors;
}

/**
 * Validate a single .scm file
 */
/**
 * Detect fragment captures (heuristic warnings)
 *
 * These are warnings, not errors - they suggest possible improvements
 * but don't fail validation (manual review recommended)
 */
export function detect_fragment_captures(content: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const line_num = i + 1;

    // Pattern 1: property_identifier with @reference.call (TypeScript/JavaScript)
    if (line.match(/property_identifier\)\s+@reference\.call(?!\w)/)) {
      warnings.push({
        line: line_num,
        capture: "@reference.call",
        message: "Capture on property_identifier (fragment). Should capture call_expression (complete unit)",
        suggestion: "Move @reference.call to parent call_expression node"
      });
    }

    // Pattern 2: field_identifier with @reference.call (Rust)
    if (line.match(/field_identifier\)\s+@reference\.call(?!\w)/)) {
      warnings.push({
        line: line_num,
        capture: "@reference.call",
        message: "Capture on field_identifier (fragment). Should capture call_expression (complete unit)",
        suggestion: "Move @reference.call to parent call_expression node"
      });
    }

    // Pattern 3: identifier in attribute context with @reference.call (Python)
    if (line.match(/attribute:\s*\(identifier\)\s+@reference\.call(?!\w)/) &&
        !line.match(/function:\s*\(identifier\)/)) {  // Exclude top-level function calls
      warnings.push({
        line: line_num,
        capture: "@reference.call",
        message: "Capture on attribute identifier (fragment). Should capture call node (complete unit)",
        suggestion: "Move @reference.call to parent call node"
      });
    }

    // Pattern 4: Duplicate captures on same line
    const call_captures = (line.match(/@reference\.call(\.\w+)?/g) || []);
    if (call_captures.length > 1) {
      warnings.push({
        line: line_num,
        capture: call_captures.join(', '),
        message: "Multiple @reference.call captures on same line (duplicates)",
        suggestion: "Use single capture on complete node only"
      });
    }
  }

  return warnings;
}

export function validate_scm_file(
  file_path: string,
  schema: CaptureSchema
): ValidationResult {
  const content = fs.readFileSync(file_path, "utf-8");
  const language = path.basename(file_path, ".scm") as Language;
  const captures = extract_captures(content);
  const errors = validate_captures(captures, schema);
  const warnings = detect_fragment_captures(content);
  const stats = collect_stats(captures);

  return {
    file: file_path,
    language,
    errors,
    warnings,
    stats,
    passed: errors.length === 0,  // Warnings don't fail validation
  };
}
```

### Step 1b: Fragment Capture Detection Patterns

**Regex patterns to detect fragment captures** (heuristic, not perfect):

| Pattern | Regex | Language | What It Detects |
|---------|-------|----------|-----------------|
| Property identifier fragment | `/property_identifier\)\s+@reference\.call(?!\w)/` | TS/JS | Capture on property_identifier instead of call_expression |
| Field identifier fragment | `/field_identifier\)\s+@reference\.call(?!\w)/` | Rust | Capture on field_identifier instead of call_expression |
| Attribute identifier fragment | `/attribute:\s*\(identifier\)\s+@reference\.call(?!\w)/` | Python | Capture on identifier instead of call node |
| Duplicate on same line | `/@reference\.call(\.\w+)?/g` (count > 1) | All | Multiple captures for same construct |

**Key insight**: Fragment captures appear on **child nodes** (property_identifier, field_identifier, identifier in attribute) while complete captures appear on **parent nodes** (call_expression, call).

**Validation approach**:

- Patterns above generate **warnings** (not errors)
- Warnings don't fail CI but flag for review
- Developers should fix warnings during query refactoring

### Step 2: Implement Statistics Collection (0.5 day)

```typescript
export function collect_stats(captures: ParsedCapture[]): CaptureStats {
  const by_category = new Map<string, number>();
  const by_entity = new Map<string, number>();
  const unique = new Set<string>();

  for (const capture of captures) {
    unique.add(capture.full_name);

    by_category.set(
      capture.category,
      (by_category.get(capture.category) || 0) + 1
    );

    if (capture.entity) {
      by_entity.set(capture.entity, (by_entity.get(capture.entity) || 0) + 1);
    }
  }

  return {
    total_captures: captures.length,
    unique_captures: unique.size,
    by_category: Object.fromEntries(by_category),
    by_entity: Object.fromEntries(by_entity),
  };
}
```

### Step 3: Implement Report Formatting (0.5 day)

```typescript
export function format_validation_report(result: ValidationResult): string {
  let output = `\n${"=".repeat(80)}\n`;
  output += `Validating: ${result.file}\n`;
  output += `Language: ${result.language}\n`;
  output += `${"=".repeat(80)}\n\n`;

  if (result.passed) {
    output += `✅ PASSED - No errors found\n\n`;
  } else {
    output += `❌ FAILED - ${result.errors.length} error(s) found\n\n`;

    for (const error of result.errors) {
      output += `Error at line ${error.line}:\n`;
      output += `  Capture: ${error.capture}\n`;
      output += `  Rule: ${error.rule_violated}\n`;
      output += `  Issue: ${error.message}\n`;

      if (error.fix) {
        output += `  Fix: ${error.fix}\n`;
      }

      if (error.example) {
        output += `\n  Example:\n`;
        output += error.example
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n");
        output += "\n";
      }

      output += "\n";
    }
  }

  // Stats
  output += `\nStatistics:\n`;
  output += `  Total captures: ${result.stats.total_captures}\n`;
  output += `  Unique captures: ${result.stats.unique_captures}\n`;
  output += `  By category:\n`;
  for (const [cat, count] of Object.entries(result.stats.by_category)) {
    output += `    ${cat}: ${count}\n`;
  }

  return output;
}
```

### Step 4: Build Test Suite (1 day)

**Test categories:**

```typescript
describe("Capture Validation", () => {
  describe("Schema Loading", () => {
    it("should load canonical schema without errors", () => {
      expect(() => CANONICAL_CAPTURE_SCHEMA).not.toThrow();
      expect(CANONICAL_CAPTURE_SCHEMA.required.length).toBeGreaterThan(0);
    });
  });

  describe("Capture Extraction", () => {
    it("should extract captures from .scm content", () => {
      const content = `
        (function_declaration
          name: (identifier) @definition.function
        )
      `;
      const captures = extract_captures(content);
      expect(captures).toHaveLength(1);
      expect(captures[0].full_name).toBe("@definition.function");
    });

    it("should extract multiple captures per line", () => {
      const content = `(call function: (identifier) @reference.call) @reference.call.full`;
      const captures = extract_captures(content);
      expect(captures).toHaveLength(2);
    });
  });

  describe("Prohibited Pattern Detection", () => {
    it("should detect duplicate method call captures", () => {
      const captures = [
        {
          full_name: "@reference.call",
          line: 1,
          category: "reference",
          entity: "call",
          qualifiers: [],
        },
        {
          full_name: "@reference.call.full",
          line: 2,
          category: "reference",
          entity: "call",
          qualifiers: ["full"],
        },
      ];
      const errors = validate_captures(captures, CANONICAL_CAPTURE_SCHEMA);
      const duplicate_errors = errors.filter(
        (e) => e.capture === "@reference.call.full"
      );
      expect(duplicate_errors.length).toBeGreaterThan(0);
    });

    it("should provide fix suggestions for prohibited patterns", () => {
      const captures = [
        {
          full_name: "@reference.call.chained",
          line: 1,
          category: "reference",
          entity: "call",
          qualifiers: ["chained"],
        },
      ];
      const errors = validate_captures(captures, CANONICAL_CAPTURE_SCHEMA);
      expect(errors[0].fix).toContain("@reference.call");
    });
  });

  describe("Required Pattern Checking", () => {
    it("should detect missing required captures", () => {
      const captures = []; // Empty - missing everything
      const errors = validate_captures(captures, CANONICAL_CAPTURE_SCHEMA);
      const missing_errors = errors.filter(
        (e) => e.rule_violated === "missing_required"
      );
      expect(missing_errors.length).toBeGreaterThan(0);
    });
  });

  describe("Naming Convention", () => {
    it("should accept valid capture names", () => {
      expect(is_valid_capture("@definition.function")).toBe(true);
      expect(is_valid_capture("@reference.call")).toBe(true);
      expect(is_valid_capture("@scope.function.body")).toBe(true);
    });

    it("should reject invalid capture names", () => {
      expect(is_valid_capture("@invalid")).toBe(false); // Missing entity
      expect(is_valid_capture("@a.b.c.d")).toBe(false); // Too deep
      expect(is_valid_capture("@reference.call.full")).toBe(false); // Prohibited
    });
  });

  describe("File Validation", () => {
    it("should validate TypeScript queries", () => {
      const result = validate_scm_file(
        "queries/typescript.scm",
        CANONICAL_CAPTURE_SCHEMA
      );
      expect(result.language).toBe("typescript");
      // After fixes, should pass:
      // expect(result.passed).toBe(true);
    });
  });

  describe("Cross-Language Consistency", () => {
    it("should have similar capture counts for TS/JS", () => {
      const ts_result = validate_scm_file(
        "queries/typescript.scm",
        CANONICAL_CAPTURE_SCHEMA
      );
      const js_result = validate_scm_file(
        "queries/javascript.scm",
        CANONICAL_CAPTURE_SCHEMA
      );

      const diff = Math.abs(
        ts_result.stats.total_captures - js_result.stats.total_captures
      );
      expect(diff).toBeLessThan(50); // TS may have type-specific captures
    });
  });
});
```

### Step 5: Create CLI Tool (0.5 day)

```typescript
// scripts/validate_captures.ts
import { validate_all_languages } from "../packages/core/src/index_single_file/query_code_tree/validate_captures";
import { CANONICAL_CAPTURE_SCHEMA } from "../packages/core/src/index_single_file/query_code_tree/capture_schema";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const json_output = args.includes("--json");
const specific_lang = args
  .find((arg) => arg.startsWith("--lang="))
  ?.split("=")[1];

async function main() {
  const results = specific_lang
    ? [
        validate_scm_file(
          `queries/${specific_lang}.scm`,
          CANONICAL_CAPTURE_SCHEMA
        ),
      ]
    : validate_all_languages();

  if (json_output) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      console.log(format_validation_report(result));
    }
  }

  // Exit with error if any validation failed
  const failed = results.some((r) => !r.passed);
  process.exit(failed ? 1 : 0);
}

main();
```

**Add to package.json:**

```json
{
  "scripts": {
    "validate:captures": "tsx scripts/validate_captures.ts"
  }
}
```

### Step 6: Integrate with CI (0.5 day)

**Update `.github/workflows/test.yml`:**

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install

      - name: Validate query captures
        run: npm run validate:captures -- --json

      - name: Run tests
        run: npm test
```

---

## Acceptance Criteria

- [ ] `validate_captures.ts` implements all core validation functions
- [ ] Can extract captures from .scm files with line numbers
- [ ] Positive validation: checks all captures are in required OR optional lists
- [ ] Checks for missing required patterns
- [ ] Fragment detection: warns about captures on child nodes (property_identifier, field_identifier, etc.)
- [ ] Validates naming conventions
- [ ] Collects meaningful statistics
- [ ] Formats human-readable error/warning reports (errors fail CI, warnings don't)
- [ ] Supports JSON output for CI
- [ ] Test suite has >90% coverage
- [ ] All tests pass
- [ ] CLI tool works with all options (--lang, --verbose, --json)
- [ ] CI integration validates on every commit
- [ ] Schema violations (errors) block PR merge
- [ ] Fragment warnings visible in CI output but don't block

---

## Dependencies

- **Depends on**: Task 11.154.2 (schema must be defined)

---

## Blocks

- **Tasks 11.154.4-7** - Need validation to verify query file fixes

---

## Time Breakdown

- **Core validation logic**: 1 day
- **Statistics & reporting**: 0.5 day
- **Report formatting**: 0.5 day
- **Test suite**: 1 day
- **CLI tool**: 0.5 day
- **CI integration**: 0.5 day

**Total: 3 days**
