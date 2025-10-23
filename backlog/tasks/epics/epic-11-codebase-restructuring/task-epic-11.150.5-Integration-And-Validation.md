# Task: Integration and Validation

**Parent**: task-epic-11.150
**Status**: TODO
**Priority**: High
**Estimated Effort**: 0.5 day
**Depends On**: task-epic-11.150.1, task-epic-11.150.2, task-epic-11.150.3, task-epic-11.150.4

## Goal

Verify that property types flow correctly through the system and property chain resolution works end-to-end.

## Validation Steps

### Step 1: Verify TypeRegistry Integration

Ensure property types are stored in TypeRegistry:

```typescript
// In type_registry.ts or integration test
it("should create type bindings for class properties", () => {
  const code = `
    class Project {
      definitions: DefinitionRegistry;
      
      update_file() {
        this.definitions.update_file();
      }
    }
  `;
  
  const project = new Project();
  project.update_file(file_path, code);
  
  const project_class = /* find Project class */;
  const definitions_field = /* find definitions property */;
  
  // Verify type binding exists
  const field_type = project.types.get_symbol_type(definitions_field.symbol_id);
  expect(field_type).toBeTruthy();
  
  const type_def = project.definitions.get(field_type);
  expect(type_def?.name).toBe("DefinitionRegistry");
});
```

### Step 2: Verify Property Chain Resolution

Test that method calls resolve correctly:

```typescript
it("should resolve method calls through property chains", () => {
  const code = `
    class Project {
      definitions: DefinitionRegistry;
      
      update_file() {
        this.definitions.update_file();  // Should resolve
      }
    }
    
    class DefinitionRegistry {
      update_file() {}
    }
  `;
  
  const project = new Project();
  project.update_file(file_path, code);
  
  const calls = project.resolutions.get_file_calls(file_path);
  const update_file_call = calls.find(c => c.name === "update_file");
  
  expect(update_file_call).toBeDefined();
  expect(update_file_call.symbol_id).toContain("DefinitionRegistry");
  // Should resolve to DefinitionRegistry.update_file, not Project.update_file
});
```

### Step 3: Run Self-Analysis

```bash
# Run the self-analysis script
npx tsx packages/core/analyze_self.ts

# Expected output:
# Found X entry points  (should be ~10-20, down from 135)
```

### Step 4: Verify Entry Point Reduction

Check the analysis output:

```json
{
  "total_entry_points": 15,  // Down from 135!
  "entry_points": [
    // Should only include actual API entry points:
    // - exported functions from index.ts
    // - public API methods
    // NOT internal methods like update_file()
  ]
}
```

### Step 5: Cross-File Property Access

Test property access across file boundaries:

```typescript
// file1.ts
export class Registry {
  public symbols: Map<string, Symbol>;
}

// file2.ts
import { Registry } from "./file1";

class Project {
  registry: Registry;
  
  lookup(name: string) {
    this.registry.symbols.get(name);  // Multi-level chain
  }
}
```

## Integration Tests

### Test 1: TypeScript End-to-End

```typescript
describe("Property chain resolution E2E - TypeScript", () => {
  it("resolves this.field.method() correctly", () => {
    // Test full integration
  });
});
```

### Test 2: JavaScript End-to-End

```javascript
describe("Property chain resolution E2E - JavaScript", () => {
  it("resolves property chains with JSDoc types", () => {
    // Test JSDoc type flow
  });
});
```

### Test 3: Python End-to-End

```python
describe("Property chain resolution E2E - Python", () => {
  it("resolves self.field.method() correctly", () => {
    // Test Python type hint flow
  });
});
```

### Test 4: Rust End-to-End

```rust
describe("Property chain resolution E2E - Rust", () => {
  it("resolves receiver.field.method() correctly", () => {
    // Test Rust type flow
  });
});
```

## Performance Testing

Ensure no regression in analysis time:

```bash
# Before changes
time npx tsx packages/core/analyze_self.ts

# After changes (should be similar or faster due to better resolution)
time npx tsx packages/core/analyze_self.ts
```

## Acceptance Criteria

- [ ] Property types flow to TypeRegistry correctly
- [ ] Property chain resolution uses extracted types
- [ ] Self-analysis shows entry points reduced from 135 to ~10-20
- [ ] All 4 language E2E tests pass
- [ ] No performance regression
- [ ] All existing tests still pass
- [ ] Cross-file property access works

## Success Metrics

**Before:**
- Entry points: 135
- False positives: ~125
- Property type bindings: 0

**After:**
- Entry points: ~10-20
- False positives: ~0-5
- Property type bindings: 100+ (all class fields)

## Rollback Plan

If integration issues occur:
1. Feature flag property type extraction
2. Disable property chain resolution temporarily
3. Debug specific language issues independently
4. Re-enable incrementally per language
