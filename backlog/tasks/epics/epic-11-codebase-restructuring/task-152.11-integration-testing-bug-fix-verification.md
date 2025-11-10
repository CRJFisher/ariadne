# Task 152.11: Integration Testing - Verify Bug Fix

**Parent**: task-152 (Split SymbolReference into specific reference types)
**Status**: TODO
**Priority**: Critical
**Estimated Effort**: 4 hours
**Phase**: 3 - Self-Reference Bug Fix

## Purpose

Run integration tests on the actual misidentified cases from `internal_misidentified.json` to verify that the bug fix resolves the 42 instances (31%) that were failing due to self-reference resolution.

## Test Against Real Failures

### Extract Test Cases from internal_misidentified.json

Create test cases from the actual failures:

**File**: `packages/core/src/__tests__/integration/bug_fix_verification.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import { build_semantic_index } from '../../index_single_file/index_single_file';
import { resolve_references } from '../../resolve_references/resolve_references';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Integration tests verifying the self-reference bug fix
 *
 * These tests use actual code from the codebase that was failing before
 * the discriminated union refactor.
 *
 * Expected outcome: All 42 self-reference cases should now resolve correctly.
 */

describe('Bug Fix Verification - Self-Reference Resolution', () => {
  describe('TypeScript this.method() failures', () => {
    test('IndexBuilder.build_class() resolution', () => {
      // Real code from packages/core/src/index_single_file/index_builder.ts:123
      const code = `
        export class IndexBuilder {
          process_class_declaration(node: Parser.SyntaxNode): void {
            this.build_class(node);  // Previously failed to resolve
          }

          private build_class(node: Parser.SyntaxNode): void {
            // Implementation
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      // Find the this.build_class reference
      const self_ref = semantic_index.references.find(
        (ref) =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'build_class'
      );

      expect(self_ref).toBeDefined();

      // CRITICAL: This should now resolve (was failing before)
      const resolved_id = resolutions.get(self_ref!.location);
      expect(resolved_id).toBeDefined();
      expect(resolved_id).toMatch(/^symbol:.*build_class$/);
    });

    test('IndexBuilder.build_function() resolution', () => {
      const code = `
        export class IndexBuilder {
          process_function_declaration(node: Parser.SyntaxNode): void {
            this.build_function(node);  // Previously failed
          }

          private build_function(node: Parser.SyntaxNode): void {
            // Implementation
          }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref) =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'build_function'
      );

      expect(self_ref).toBeDefined();
      const resolved_id = resolutions.get(self_ref!.location);
      expect(resolved_id).toBeDefined();
    });

    test('Multiple chained this.method() calls', () => {
      const code = `
        export class IndexBuilder {
          process(node: Parser.SyntaxNode): void {
            this.build_class(node);      // Call 1
            this.build_function(node);   // Call 2
            this.build_variable(node);   // Call 3
          }

          private build_class(node: Parser.SyntaxNode): void { }
          private build_function(node: Parser.SyntaxNode): void { }
          private build_variable(node: Parser.SyntaxNode): void { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_refs = semantic_index.references.filter(
        (ref) => ref.kind === 'self_reference_call'
      );

      expect(self_refs).toHaveLength(3);

      // ALL THREE should resolve
      const resolved_count = self_refs.filter((ref) =>
        resolutions.has(ref.location)
      ).length;

      expect(resolved_count).toBe(3);
    });

    test('Nested scope this.method() resolution', () => {
      const code = `
        export class ScopeProcessor {
          process_scopes(): void {
            for (const scope of this.scopes) {
              if (this.is_valid_scope(scope)) {  // Nested in if, in for
                this.process_scope(scope);
              }
            }
          }

          private is_valid_scope(scope: Scope): boolean { return true; }
          private process_scope(scope: Scope): void { }
        }
      `;

      const semantic_index = build_semantic_index(code, 'typescript');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_refs = semantic_index.references.filter(
        (ref) => ref.kind === 'self_reference_call'
      );

      // Both calls should resolve despite nested scopes
      const resolved_count = self_refs.filter((ref) =>
        resolutions.has(ref.location)
      ).length;

      expect(resolved_count).toBe(self_refs.length);
    });
  });

  describe('Python self.method() failures', () => {
    test('IndexBuilder.build_class() resolution', () => {
      const code = `
        class IndexBuilder:
          def process_class(self, node):
            self.build_class(node)  # Previously failed

          def build_class(self, node):
            pass
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_ref = semantic_index.references.find(
        (ref) =>
          ref.kind === 'self_reference_call' &&
          ref.name === 'build_class'
      );

      expect(self_ref).toBeDefined();
      expect(self_ref?.keyword).toBe('self');

      const resolved_id = resolutions.get(self_ref!.location);
      expect(resolved_id).toBeDefined();
    });

    test('Multiple self.method() calls in Python', () => {
      const code = `
        class Processor:
          def run(self):
            self.step_one()
            self.step_two()
            self.step_three()

          def step_one(self):
            pass

          def step_two(self):
            pass

          def step_three(self):
            pass
      `;

      const semantic_index = build_semantic_index(code, 'python');
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      const self_refs = semantic_index.references.filter(
        (ref) => ref.kind === 'self_reference_call'
      );

      expect(self_refs.length).toBeGreaterThanOrEqual(3);

      // All should resolve
      const resolved_count = self_refs.filter((ref) =>
        resolutions.has(ref.location)
      ).length;

      expect(resolved_count).toBe(self_refs.length);
    });
  });
});

describe('Regression Tests - Ensure Other Cases Still Work', () => {
  test('Regular method calls still resolve', () => {
    const code = `
      class User {
        getName(): string { return this.name; }
      }

      function test() {
        const user = new User();
        user.getName();  // Regular method call (not self-reference)
      }
    `;

    const semantic_index = build_semantic_index(code, 'typescript');
    const resolutions = resolve_references(
      semantic_index.references,
      semantic_index
    );

    const method_call = semantic_index.references.find(
      (ref) => ref.kind === 'method_call' && ref.name === 'getName'
    );

    expect(method_call).toBeDefined();
    expect(resolutions.get(method_call!.location)).toBeDefined();
  });

  test('Function calls still resolve', () => {
    const code = `
      function helper() { }

      function main() {
        helper();  // Function call
      }
    `;

    const semantic_index = build_semantic_index(code, 'typescript');
    const resolutions = resolve_references(
      semantic_index.references,
      semantic_index
    );

    const func_call = semantic_index.references.find(
      (ref) => ref.kind === 'function_call' && ref.name === 'helper'
    );

    expect(func_call).toBeDefined();
    expect(resolutions.get(func_call!.location)).toBeDefined();
  });

  test('Constructor calls still resolve', () => {
    const code = `
      class MyClass { }

      const obj = new MyClass();
    `;

    const semantic_index = build_semantic_index(code, 'typescript');
    const resolutions = resolve_references(
      semantic_index.references,
      semantic_index
    );

    const constructor_call = semantic_index.references.find(
      (ref) => ref.kind === 'constructor_call'
    );

    expect(constructor_call).toBeDefined();
    expect(resolutions.get(constructor_call!.location)).toBeDefined();
  });
});
```

## Quantitative Verification

### Create Metrics Script

**File**: `scripts/verify_bug_fix.ts`

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import { build_semantic_index } from '../packages/core/src/index_single_file/index_single_file';
import { resolve_references } from '../packages/core/src/resolve_references/resolve_references';

/**
 * Verify the bug fix quantitatively
 *
 * This script:
 * 1. Reads internal_misidentified.json
 * 2. Identifies the 42 self-reference cases
 * 3. Re-runs resolution on those files
 * 4. Counts how many now resolve correctly
 * 5. Reports improvement percentage
 */

interface MisidentifiedCase {
  symbol_id: string;
  file_path: string;
  line: number;
  reason: string;
}

async function verify_bug_fix() {
  // Load misidentified cases
  const json_path = join(__dirname, '../top-level-nodes-analysis/results/internal_misidentified.json');
  const misidentified: MisidentifiedCase[] = JSON.parse(
    readFileSync(json_path, 'utf-8')
  );

  console.log(`Total misidentified cases: ${misidentified.length}`);

  // Filter for self-reference cases (reason contains "this." or "self.")
  const self_reference_cases = misidentified.filter(
    (case_item) =>
      case_item.reason.includes('this.') ||
      case_item.reason.includes('self.') ||
      case_item.reason.includes('super.')
  );

  console.log(`Self-reference cases: ${self_reference_cases.length}`);

  let resolved_count = 0;
  let failed_count = 0;

  for (const case_item of self_reference_cases) {
    const file_path = join(__dirname, '..', case_item.file_path);

    try {
      const code = readFileSync(file_path, 'utf-8');
      const language = file_path.endsWith('.py') ? 'python' : 'typescript';

      const semantic_index = build_semantic_index(code, language);
      const resolutions = resolve_references(
        semantic_index.references,
        semantic_index
      );

      // Check if the specific reference at the line now resolves
      const ref_at_line = semantic_index.references.find(
        (ref) =>
          ref.location.start_line === case_item.line &&
          ref.kind === 'self_reference_call'
      );

      if (ref_at_line && resolutions.has(ref_at_line.location)) {
        resolved_count++;
        console.log(`✓ Resolved: ${case_item.symbol_id}`);
      } else {
        failed_count++;
        console.log(`✗ Still failing: ${case_item.symbol_id}`);
      }
    } catch (error) {
      console.error(`Error processing ${case_item.file_path}:`, error);
      failed_count++;
    }
  }

  console.log('\n=== Bug Fix Verification Results ===');
  console.log(`Total self-reference cases: ${self_reference_cases.length}`);
  console.log(`Now resolved: ${resolved_count}`);
  console.log(`Still failing: ${failed_count}`);
  console.log(`Fix rate: ${((resolved_count / self_reference_cases.length) * 100).toFixed(1)}%`);

  // Expected: 100% fix rate (all 42 cases should resolve)
  if (resolved_count === self_reference_cases.length) {
    console.log('\n✅ BUG FIX VERIFIED: All self-reference cases now resolve!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some cases still failing. Investigation needed.');
    process.exit(1);
  }
}

verify_bug_fix().catch(console.error);
```

Run the script:

```bash
npx tsx scripts/verify_bug_fix.ts
```

Expected output:
```
Total misidentified cases: 135
Self-reference cases: 42
✓ Resolved: symbol:src/index_builder.ts:build_class:123:5
✓ Resolved: symbol:src/index_builder.ts:build_function:145:5
...
✓ Resolved: symbol:src/scope_processor.ts:process_scope:89:7

=== Bug Fix Verification Results ===
Total self-reference cases: 42
Now resolved: 42
Still failing: 0
Fix rate: 100.0%

✅ BUG FIX VERIFIED: All self-reference cases now resolve!
```

## Success Criteria

- [ ] All 42 self-reference cases from `internal_misidentified.json` now resolve
- [ ] Regression tests pass (other reference types still work)
- [ ] Integration tests pass for TypeScript, Python, JavaScript
- [ ] Verification script reports 100% fix rate
- [ ] No new failures introduced
- [ ] Build succeeds
- [ ] All tests pass

## Files Changed

**New**:
- `packages/core/src/__tests__/integration/bug_fix_verification.test.ts`
- `scripts/verify_bug_fix.ts`

## Quantitative Impact

**Before fix**:
- 135 misidentified symbols
- 42 due to self-reference bug (31%)
- Call graph accuracy: 69%

**After fix**:
- 93 misidentified symbols remaining (42 fixed)
- 0 due to self-reference bug
- Call graph accuracy: **100% for self-reference cases** (31% overall improvement)

## Next Task

After completion, proceed to **task-152.12** (Remove legacy code)
