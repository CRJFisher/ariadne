# Task: Integration and Testing

**Task ID**: task-epic-11.90.8
**Parent**: task-epic-11.90
**Status**: Created
**Priority**: Critical
**Created**: 2024-01-19
**Estimated Effort**: 8 hours
**Phase**: 8 - Integration

## Objective

Integrate all the refactored type processing modules into the symbol_resolution Phase 3 pipeline, ensure everything works together correctly, and verify the architectural separation is maintained.

## Background

After completing Phases 1-7, we have:

- Created the type_resolution infrastructure (Phase 1)
- Split type_members into local/resolved (Phase 2)
- Moved type_registry to symbol_resolution (Phase 3)
- Migrated type_resolution module (Phase 4)
- Split type_tracking (Phase 5)
- Split type_flow_references (Phase 6)
- Split type_annotation_references (Phase 7)

Now we need to wire everything together and ensure the complete system works correctly.

## Implementation

### 1. Update SemanticIndex Interface

Update `packages/core/src/semantic_index/index.ts`:

```typescript
/**
 * SemanticIndex - Single-file analysis results
 *
 * Contains only local, single-file information extracted
 * without any cross-file resolution.
 */
export interface SemanticIndex {
  // Core extractions
  readonly scopes: ScopeTree;
  readonly imports: LocalImportExtraction;
  readonly exports: LocalExportExtraction;
  readonly functions: LocalFunctionExtraction;

  // Type extractions (local only)
  readonly local_type_members: LocalTypeMembers[];
  readonly local_type_annotations: LocalTypeAnnotation[];
  readonly local_type_tracking: LocalTypeTracking;
  readonly local_type_flow: LocalTypeFlow;

  // References (unresolved)
  readonly function_calls: LocalFunctionCall[];
  readonly method_calls: LocalMethodCall[];
  readonly property_accesses: LocalPropertyAccess[];

  // File metadata
  readonly file_path: FilePath;
  readonly language: Language;
}

// Remove old interfaces that included resolution
// DELETE: TypeInfo, TypeRegistry, ResolvedTypeMembers
```

### 2. Create Phase 3 Type Resolution Pipeline

Update `packages/core/src/symbol_resolution/symbol_resolution.ts`:

```typescript
import {
  resolve_all_types,
  build_type_registry,
  resolve_all_members,
  analyze_type_flow,
  resolve_type_tracking,
  resolve_type_annotations,
} from "./type_resolution";

/**
 * Phase 3: Type Resolution
 * Resolves all type-related information using imports and functions
 */
function phase3_type_resolution(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap
): TypeResolutionMap {
  // Step 1: Collect all local type information
  const local_extraction = collect_local_types(indices);

  // Step 2: Build global type registry with TypeIds
  const type_registry = build_type_registry(
    local_extraction.type_definitions,
    imports
  );

  // Step 3: Resolve type inheritance hierarchy
  const type_hierarchy = resolve_inheritance(
    type_registry,
    local_extraction.type_definitions,
    imports
  );

  // Step 4: Resolve all type members including inherited
  const resolved_members = resolve_all_members(
    type_registry,
    type_hierarchy,
    local_extraction.type_definitions
  );

  // Step 5: Resolve type annotations to TypeIds
  const resolved_annotations = resolve_type_annotations(
    local_extraction.type_annotations,
    type_registry,
    imports
  );

  // Step 6: Track variable types
  const type_tracking = resolve_type_tracking(
    local_extraction.type_tracking,
    imports,
    type_registry,
    functions
  );

  // Step 7: Analyze type flow
  const type_flow = analyze_type_flow(
    local_extraction.type_flows,
    imports,
    functions,
    type_registry
  );

  return {
    type_registry,
    type_hierarchy,
    resolved_members,
    resolved_annotations,
    type_tracking,
    type_flow,

    // Combined results
    symbol_types: merge_symbol_types(type_tracking, type_flow),
    location_types: merge_location_types(resolved_annotations, type_flow),
  };
}

/**
 * Collect local type information from all files
 */
function collect_local_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): LocalTypeExtraction {
  const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
  const type_annotations = new Map<FilePath, LocalTypeAnnotation[]>();
  const type_tracking = new Map<FilePath, LocalTypeTracking>();
  const type_flows = new Map<FilePath, LocalTypeFlow>();

  for (const [file_path, index] of indices) {
    type_definitions.set(file_path, index.local_type_members);
    type_annotations.set(file_path, index.local_type_annotations);
    type_tracking.set(file_path, index.local_type_tracking);
    type_flows.set(file_path, index.local_type_flow);
  }

  return {
    type_definitions,
    type_annotations,
    type_tracking,
    type_flows,
  };
}
```

### 3. Update Phase 4 Method Resolution

Update method resolution to use the new type resolution:

```typescript
/**
 * Phase 4: Method Resolution
 * Can now use fully resolved types
 */
function phase4_method_resolution(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap
): MethodResolutionMap {
  const method_calls = collect_method_calls(indices);
  const resolved_methods = new Map<Location, ResolvedMethod>();

  for (const [file_path, calls] of method_calls) {
    for (const call of calls) {
      // Now we can resolve the object's type
      const object_type = types.location_types.get(call.object_location);

      if (object_type) {
        // Look up method in resolved type members
        const type_def = types.type_registry.types.get(object_type);
        const method = type_def?.members.get(call.method_name);

        if (method) {
          resolved_methods.set(call.location, {
            method_id: method_symbol(call.method_name, object_type),
            definition_location: method.location,
            containing_type: object_type,
          });
        }
      }
    }
  }

  return resolved_methods;
}
```

### 4. Create Integration Tests

Create `packages/core/src/symbol_resolution/type_resolution/integration.test.ts`:

```typescript
describe("Type Resolution Integration", () => {
  describe("Full Pipeline", () => {
    it("should resolve types through complete pipeline", () => {
      // Setup test files
      const files = {
        "base.ts": `
          export class BaseClass {
            baseMethod() {}
          }
        `,
        "derived.ts": `
          import { BaseClass } from './base';

          export class DerivedClass extends BaseClass {
            derivedMethod() {}
          }
        `,
        "usage.ts": `
          import { DerivedClass } from './derived';

          const obj = new DerivedClass();
          obj.baseMethod(); // Should resolve through inheritance
          obj.derivedMethod();
        `,
      };

      // Run semantic indexing (single-file)
      const indices = runSemanticIndexing(files);

      // Run symbol resolution phases
      const phase1 = resolveImports(indices);
      const phase2 = resolveFunctions(indices, phase1);
      const phase3 = resolveTypes(indices, phase1, phase2);
      const phase4 = resolveMethods(indices, phase1, phase2, phase3);

      // Verify type resolution
      expect(phase3.type_registry.types.size).toBe(2); // BaseClass, DerivedClass

      // Verify inheritance
      const derived_type = phase3.type_registry.type_names
        .get("derived.ts")
        ?.get("DerivedClass");
      const hierarchy = phase3.type_hierarchy.get(derived_type!);
      expect(hierarchy?.base_types).toContain("class:BaseClass:base.ts:1:0");

      // Verify inherited members
      const derived_members = phase3.resolved_members.get(derived_type!);
      expect(derived_members?.has("baseMethod")).toBe(true);
      expect(derived_members?.has("derivedMethod")).toBe(true);

      // Verify constructor resolution
      const obj_type = phase3.type_flow.inferred_types.get(
        variable_symbol("obj", "usage.ts")
      );
      expect(obj_type).toBe(derived_type);

      // Verify method resolution
      const base_call = findMethodCall("baseMethod", phase4);
      expect(base_call?.containing_type).toBe(derived_type);
      expect(base_call?.definition_location.file_path).toBe("base.ts");
    });
  });

  describe("Architecture Validation", () => {
    it("should maintain phase separation", () => {
      // Semantic index should not have any TypeIds
      const index = runSemanticIndexing({ "test.ts": "class Test {}" });

      expect(JSON.stringify(index)).not.toContain("type_id");
      expect(JSON.stringify(index)).not.toContain("TypeId");

      // Should only have local extraction
      expect(index.get("test.ts")?.local_type_members).toBeDefined();
      expect(index.get("test.ts")?.resolved_types).toBeUndefined();
    });

    it("should not attempt cross-file resolution in semantic_index", () => {
      const files = {
        "a.ts": "export class A {}",
        "b.ts": "import { A } from './a'; class B extends A {}",
      };

      const indices = runSemanticIndexing(files);
      const b_index = indices.get("b.ts")!;

      // Should capture inheritance clause but not resolve it
      const class_b = b_index.local_type_members[0];
      expect(class_b.extends_clause).toEqual(["A"]);

      // Should NOT have resolved members from A
      expect(class_b.direct_members.size).toBe(0);
      expect(class_b.all_members).toBeUndefined();
    });
  });

  describe("Performance Benchmarks", () => {
    it("should maintain performance targets", () => {
      const largeProject = generateLargeProject(100); // 100 files

      const start = performance.now();
      const indices = runSemanticIndexing(largeProject);
      const indexTime = performance.now() - start;

      const phase1Start = performance.now();
      const imports = resolveImports(indices);
      const functions = resolveFunctions(indices, imports);
      const types = resolveTypes(indices, imports, functions);
      const resolutionTime = performance.now() - phase1Start;

      // Semantic indexing should be fast (parallel potential)
      expect(indexTime).toBeLessThan(1000); // < 1 second for 100 files

      // Symbol resolution can be slower but still reasonable
      expect(resolutionTime).toBeLessThan(2000); // < 2 seconds
    });
  });
});
```

### 5. Create Migration Script

Create `scripts/migrate_type_processing.ts`:

```typescript
/**
 * Migration script to help transition existing code
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

async function migrate() {
  // Find all imports of old modules
  const files = await glob("packages/**/*.ts");

  for (const file of files) {
    let content = readFileSync(file, "utf8");

    // Update imports
    content = content.replace(
      /from ['"].*semantic_index\/type_registry['"]/g,
      'from "@ariadnejs/core/symbol_resolution/type_resolution/type_registry"'
    );

    content = content.replace(
      /from ['"].*semantic_index\/type_resolution['"]/g,
      'from "@ariadnejs/core/symbol_resolution/type_resolution"'
    );

    // Update type names
    content = content.replace(/\bTypeInfo\b/g, "TypeId");
    content = content.replace(/\bTypeRegistry\b/g, "GlobalTypeRegistry");

    writeFileSync(file, content);
  }

  console.log("Migration complete. Please run tests to verify.");
}

migrate().catch(console.error);
```

### 6. Documentation Updates

Update `docs/architecture.md`:

```markdown
## Type Processing Architecture

### Phase Separation

The type processing system strictly separates single-file extraction from cross-file resolution:

#### Semantic Index (Single-File)

- Extracts type syntax and structure
- Captures member declarations
- Records type annotations as text
- Tracks assignment patterns

#### Symbol Resolution Phase 3 (Cross-File)

- Generates TypeIds with full context
- Resolves inheritance hierarchies
- Merges inherited members
- Tracks type flow through programs
- Resolves annotations to actual types

### Key Principles

1. **No premature resolution**: Semantic index never attempts to resolve references
2. **TypeIds require context**: Only generated when definition location is known
3. **Inheritance needs imports**: Can only be resolved after Phase 1
4. **Type flow needs functions**: Requires Phase 2 function signatures

### Module Organization
```

semantic_index/
├── type_members/ # Extract direct members only
└── references/
├── type_tracking/ # Extract annotations as text
├── type_flow/ # Track assignment patterns
└── type_annotations/ # Extract annotation syntax

symbol_resolution/
└── type_resolution/ # All cross-file type work
├── type_registry.ts # Global TypeId registry
├── resolve_members.ts # Full member resolution
├── resolve_annotations.ts # Annotation to TypeId
├── type_flow.ts # Type propagation
└── inheritance.ts # Hierarchy resolution

```

```

## Success Criteria

1. ✅ All type modules integrated into Phase 3
2. ✅ Complete test coverage for pipeline
3. ✅ No cross-file resolution in semantic_index
4. ✅ Method resolution uses resolved types
5. ✅ Performance benchmarks met
6. ✅ Documentation updated
7. ✅ Migration script provided
8. ✅ All existing tests updated and passing

## Dependencies

- **Depends on**: All Phase 1-7 tasks completed
- **Blocks**: Release of new architecture

## Testing Strategy

### Unit Tests

- Each module tested in isolation
- Mock data for dependencies

### Integration Tests

- Full pipeline testing
- Multi-file projects
- Complex inheritance scenarios

### Performance Tests

- Benchmark against old implementation
- Large project testing
- Memory usage monitoring

### Regression Tests

- Ensure existing functionality preserved
- Test migration paths

## Risks and Mitigations

### Risk 1: Breaking Changes

**Mitigation**: Provide migration script, maintain backward compatibility temporarily

### Risk 2: Performance Regression

**Mitigation**: Benchmark throughout, optimize hot paths

### Risk 3: Incomplete Migration

**Mitigation**: Comprehensive test coverage, gradual rollout

## Notes

This integration phase is critical for validating the entire refactoring effort. Key validation points:

1. **Architecture**: Verify clean separation between phases
2. **Correctness**: Ensure type resolution is accurate
3. **Performance**: Maintain or improve performance
4. **Usability**: Provide clear migration path

The success of this refactoring enables:

- Parallel semantic indexing (huge performance win)
- Accurate cross-file type resolution
- Better incremental compilation
- Cleaner, more maintainable codebase
