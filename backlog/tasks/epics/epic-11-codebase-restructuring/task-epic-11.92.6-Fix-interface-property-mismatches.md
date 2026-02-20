# Task: Fix Interface Property Mismatches

**Task ID**: task-epic-11.92.6
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 1.5 days

## Summary

Fix 69 TypeScript TS2339 errors where properties don't exist on types, plus related interface inconsistencies. These represent fundamental structural mismatches between modules.

## Problem Analysis

### Major Property Mismatches

1. **LocationKey Interface Issues** (10+ errors)
   - Properties `file_path`, `line`, `column` don't exist on LocationKey
   - LocationKey is a string but code expects Location object

2. **SemanticModifiers Missing Properties** (5 errors)
   - Missing: `is_try`, `is_await`, `visibility`, `is_loop`
   - Rust-specific modifiers not defined in TypeScript types

3. **LocalTypeFlow Complete Mismatch**
   - Semantic index version has different structure than type resolution
   - Incompatible interface definitions between modules

4. **CaptureContext Issues** (2 errors)
   - Missing `target_location` property
   - Interface divergence between modules

5. **SemanticIndex Missing Properties**
   - Missing `type_registry` property (3 errors)
   - Interface doesn't match implementation

## Affected Files

### Core Issues
- `semantic_index/references/type_annotation_references/type_annotation_references.ts:192-193`
- `symbol_resolution/data_export/resolution_exporter.ts:112`
- `symbol_resolution/examples/basic_usage.ts:179-180`

### Test Issues
- `semantic_index/semantic_index.rust.test.ts` (5 errors)
- `semantic_index/references/reference_types.test.ts`
- `semantic_index/references/references.test.ts`

## Implementation Strategy

### Step 1: Fix LocationKey Usage (3 hours)
- Audit all LocationKey usages
- Convert string keys to proper Location objects where needed
- Or update interfaces to work with string keys consistently

### Step 2: Add Missing SemanticModifiers (2 hours)
```typescript
interface SemanticModifiers {
  // Existing...
  is_try?: boolean;      // Rust-specific
  is_await?: boolean;    // Rust-specific
  visibility?: string;   // Rust-specific
  is_loop?: boolean;     // Rust-specific
}
```

### Step 3: Reconcile LocalTypeFlow Interfaces (4 hours)
- Determine correct interface structure
- Create conversion utilities if both needed
- Update all usages consistently

### Step 4: Fix CaptureContext (2 hours)
- Add missing `target_location` property
- Update all capture context usages
- Fix type annotation references

### Step 5: Add type_registry to SemanticIndex (1 hour)
- Add property to interface
- Ensure proper initialization
- Update tests

## Detailed Fixes

### LocationKey Fix Options

**Option 1: Use Location objects**
```typescript
// Change from
type LocationKey = string;
// To structured type that matches usage
```

**Option 2: Fix accessors**
```typescript
// Change from
locationKey.file_path
// To
const location = parseLocationKey(locationKey);
location.file_path
```

### LocalTypeFlow Resolution

**Current Conflicts:**
```typescript
// semantic_index version
interface LocalTypeFlow {
  constructor_calls: ConstructorCall[];
  assignments: Assignment[];
  returns: Return[];
  call_assignments: CallAssignment[];
}

// type_resolution version
interface LocalTypeFlow {
  source_location: Location;
  target_location: Location;
  flow_kind: "assignment" | "return" | "parameter";
  scope_id: ScopeId;
}
```

**Resolution:** These serve different purposes - rename one or create separate types.

## Success Criteria
- All TS2339 property errors resolved
- Interfaces consistent across modules
- No runtime property access errors

## Verification
```bash
# Check property errors
npm run build 2>&1 | grep "TS2339" | wc -l
# Expected: 0

# Validate interfaces
npm run build 2>&1 | grep "Property.*does not exist" | wc -l
# Expected: 0
```

## Dependencies
- Should be done after task-epic-11.92.5 (ReadonlyMap fixes)
- May require coordination with semantic index team

## Risks
- Changing core interfaces may have wide impact
- Need to maintain backwards compatibility
- Some properties may be language-specific (Rust)