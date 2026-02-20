# Task: Move TypeRegistry Update After Resolution in Project

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.144 - Merge TypeContext into TypeRegistry
**Status**: Completed
**Priority**: High
**Complexity**: Medium

## Overview

Restructure `Project.update_file()` and `Project.remove_file()` to call `TypeRegistry.update_file()` AFTER `ResolutionRegistry.resolve_files()`. Update TypeRegistry.update_file() to call resolve_type_metadata() internally.

## Context

**Current Flow in Project.update_file():**
```typescript
// Phase 1: Index file
const index = index_single_file(...);

// Phase 2: Update all registries
this.definitions.update_file(file_id, index);
this.types.update_file(file_id, index);      // ← Called here
this.scopes.update_file(file_id, index);
this.exports.update_file(file_id, index);
this.imports.update_file(file_id, imports);

// Phase 3: Resolve references
this.resolutions.resolve_files(affected_files, ...);

// TypeRegistry resolution happens later in resolve_calls() - wrong!
```

**Problem:** TypeRegistry stores names, but needs ResolutionRegistry to convert names → SymbolIds. Currently this happens in `resolve_calls()`, causing repeated work.

**New Flow:**
```typescript
// Phase 1: Index file
const index = index_single_file(...);

// Phase 2: Update pure registries (no cross-dependencies)
this.definitions.update_file(file_id, index);
this.scopes.update_file(file_id, index);
this.exports.update_file(file_id, index);
this.imports.update_file(file_id, imports);

// Phase 3: Resolve references (needs all above registries)
this.resolutions.resolve_files(affected_files, ...);

// Phase 4: Update type registry (needs resolutions!)
for (const affected_file of affected_files) {
  const affected_index = this.semantic_indexes.get(affected_file);
  if (affected_index) {
    this.types.update_file(
      affected_file,
      affected_index,
      this.definitions,
      this.resolutions
    );
  }
}
```

## Goals

1. Move TypeRegistry.update_file() to after ResolutionRegistry.resolve_files()
2. Update TypeRegistry.update_file() signature to accept definitions and resolutions
3. Call resolve_type_metadata() internally from update_file()
4. Update remove_file() similarly
5. Ensure all affected files get type metadata resolved

## Implementation

### 1. Update TypeRegistry.update_file() Signature

Change signature to accept resolution dependencies:

```typescript
export class TypeRegistry {
  /**
   * Update type information for a file.
   *
   * Two-phase process:
   * 1. Extract type metadata from semantic index (names)
   * 2. Resolve type metadata to SymbolIds (using ResolutionRegistry)
   *
   * NOTE: Must be called AFTER ResolutionRegistry.resolve_files() for the file.
   *
   * @param file_path - The file being updated
   * @param index - Semantic index containing type information
   * @param definitions - Definition registry (for location/scope lookups)
   * @param resolutions - Resolution registry (for name → SymbolId resolution)
   */
  update_file(
    file_path: FilePath,
    index: SemanticIndex,
    definitions: DefinitionRegistry,
    resolutions: ResolutionRegistry
  ): void {
    // Phase 1: Remove old type data from this file
    this.remove_file(file_path);

    // Phase 2: Track what this file contributes
    const contributions: FileTypeContributions = {
      bindings: new Set(),
      member_types: new Set(),
      aliases: new Set(),
      resolved_symbols: new Set(),
    };

    // Phase 3: Extract raw type data (names)
    this.extract_type_data(file_path, index, contributions);

    // Phase 4: Resolve type metadata (names → SymbolIds)
    this.resolve_type_metadata(file_path, definitions, resolutions);

    // Phase 5: Store contributions tracking
    this.by_file.set(file_path, contributions);
  }

  /**
   * Extract type metadata from semantic index.
   * Stores names - resolution happens separately.
   *
   * @param file_path - The file being processed
   * @param index - Semantic index with type information
   * @param contributions - Tracks what this file contributes
   */
  private extract_type_data(
    file_path: FilePath,
    index: SemanticIndex,
    contributions: FileTypeContributions
  ): void {
    // PASS 6: Extract type preprocessing data
    const type_bindings_from_defs = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    const type_bindings_from_ctors = extract_constructor_bindings(
      index.references
    );

    // Merge type bindings from definitions and constructors
    const type_bindings = new Map([
      ...type_bindings_from_defs,
      ...type_bindings_from_ctors,
    ]);

    const type_members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    const type_alias_metadata = extract_type_alias_metadata(index.types);

    // Store type bindings (pre-computed in SemanticIndex)
    for (const [location_key, type_name] of type_bindings) {
      this.type_bindings.set(location_key, type_name);
      contributions.bindings.add(location_key);
    }

    // Store type members
    for (const [type_id, members] of type_members) {
      this.type_members.set(type_id, members);
      contributions.member_types.add(type_id);
    }

    // Store type aliases
    for (const [alias_id, type_expr] of type_alias_metadata) {
      this.type_aliases.set(alias_id, type_expr);
      contributions.aliases.add(alias_id);
    }
  }
}
```

### 2. Update Project.update_file()

Restructure to call TypeRegistry after resolution:

```typescript
update_file(file_id: FilePath, content: string): void {
  if (!this.root_folder) {
    throw new Error("Project not initialized");
  }

  // Phase 0: Track who depends on this file (before updating imports)
  const dependents = this.imports.get_dependents(file_id);

  // Phase 1: Index file
  this.file_contents.set(file_id, content);
  const parser = this.get_or_create_parser(file_id);
  const tree = parser.parse(content);
  const semantic_index = index_single_file(file_id, content, this.detect_language(file_id));
  this.semantic_indexes.set(file_id, semantic_index);

  // Phase 2: Update pure registries (no cross-registry dependencies)
  this.definitions.update_file(file_id, semantic_index);
  // NOTE: TypeRegistry update REMOVED from here
  this.scopes.update_file(file_id, semantic_index);
  this.exports.update_file(file_id, semantic_index);

  const imports = extract_imports_from_definitions(
    semantic_index.imports,
    semantic_index.functions,
    semantic_index.classes,
    semantic_index.variables
  );
  this.imports.update_file(file_id, imports);

  // Phase 3: Resolve references (eager!)
  const affected_files = new Set([file_id, ...dependents]);
  this.resolutions.resolve_files(
    affected_files,
    this.semantic_indexes,
    this.definitions,
    this.types,        // Still needed for export metadata during resolution
    this.scopes,
    this.exports,
    this.imports,
    this.root_folder
  );

  // Phase 4: Update type registry for all affected files
  // Must happen AFTER resolution so type names can be resolved to SymbolIds
  for (const affected_file of affected_files) {
    const affected_index = this.semantic_indexes.get(affected_file);
    if (affected_index) {
      this.types.update_file(
        affected_file,
        affected_index,
        this.definitions,
        this.resolutions
      );
    }
  }
}
```

### 3. Update Project.remove_file()

Similarly update remove_file():

```typescript
remove_file(file_id: FilePath): void {
  if (!this.root_folder) {
    throw new Error("Project not initialized");
  }

  const dependents = this.imports.get_dependents(file_id);

  // Remove from file-level stores
  this.semantic_indexes.delete(file_id);
  this.file_contents.delete(file_id);

  // Remove from pure registries
  this.definitions.remove_file(file_id);
  this.types.remove_file(file_id);  // Cleans up both name-based and resolved data
  this.scopes.remove_file(file_id);
  this.exports.remove_file(file_id);
  this.imports.remove_file(file_id);

  // Remove resolutions for deleted file
  this.resolutions.remove_file(file_id);

  // Re-resolve dependent files (imports may be broken now)
  if (dependents.size > 0) {
    this.resolutions.resolve_files(
      dependents,
      this.semantic_indexes,
      this.definitions,
      this.types,
      this.scopes,
      this.exports,
      this.imports,
      this.root_folder
    );

    // Update type registry for dependents
    for (const dependent_file of dependents) {
      const dependent_index = this.semantic_indexes.get(dependent_file);
      if (dependent_index) {
        this.types.update_file(
          dependent_file,
          dependent_index,
          this.definitions,
          this.resolutions
        );
      }
    }
  }
}
```

### 4. Handle Bootstrap Issue

There's a chicken-and-egg problem: `ResolutionRegistry.resolve_files()` currently needs `TypeRegistry` for export metadata. But we're moving TypeRegistry update to after resolution.

**Solution:** TypeRegistry still stores raw export metadata even before resolution. The name-based storage remains available for use during resolution.

Verify in ResolutionRegistry that it only needs name-based type data, not resolved SymbolIds.

## Testing

Update existing tests in `project.test.ts`:

```typescript
describe("Project - TypeRegistry Integration", () => {
  it("should resolve type metadata after file update", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    project.update_file(file1, `
      class User {
        getName() { return ""; }
      }
      const user: User = new User();
    `);

    // Verify TypeRegistry has resolved type metadata
    const user_symbol = /* get user variable symbol_id */;
    const user_type = project['types'].get_symbol_type(user_symbol);
    expect(user_type).toBeDefined();

    // Verify member lookup works
    const get_name_method = project['types'].get_type_member(user_type!, "getName" as SymbolName);
    expect(get_name_method).toBeDefined();
  });

  it("should re-resolve type metadata for dependent files", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    const file2 = "file2.ts" as FilePath;

    project.update_file(file1, `export class User {}`);
    project.update_file(file2, `
      import { User } from "./file1";
      const user: User = new User();
    `);

    // Update file1
    project.update_file(file1, `
      export class User {
        getName() { return ""; }
      }
    `);

    // Verify file2's type metadata was re-resolved
    // (user variable should still have User type, with new method)
  });

  it("should handle removed files gracefully", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    const file2 = "file2.ts" as FilePath;

    project.update_file(file1, `export class User {}`);
    project.update_file(file2, `
      import { User } from "./file1";
      const user: User = new User();
    `);

    // Remove file1
    project.remove_file(file1);

    // Verify file2's type registry was updated (even though User is now unresolved)
    // Should not crash
    const call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();
  });
});
```

## Verification

After completing this task:

1. **Order correct**: TypeRegistry.update_file() called after resolution
2. **Signature updated**: TypeRegistry.update_file() takes definitions and resolutions
3. **Internal resolution**: resolve_type_metadata() called from update_file()
4. **Dependents handled**: All affected files get type metadata resolved
5. **Tests pass**: All existing and new tests pass

## Success Criteria

- [ ] TypeRegistry.update_file() signature updated
- [ ] TypeRegistry.update_file() calls resolve_type_metadata() internally
- [ ] extract_type_data() extracted as private method
- [ ] Project.update_file() calls TypeRegistry AFTER resolution
- [ ] Project.update_file() updates all affected files
- [ ] Project.remove_file() updates dependent files
- [ ] All tests passing
- [ ] Type metadata resolved correctly for all files

## Notes

- This establishes the registry pattern: update_file() handles everything
- TypeRegistry now needs ResolutionRegistry, creating proper dependency order
- Name-based storage still exists (for export metadata during resolution)
- Next task (11.144.4) will update call resolvers to use TypeRegistry directly
- Bootstrap issue resolved: name-based data available during resolution

## Dependencies

- **Requires**: task-epic-11.144.2 completed (needs TypeContext methods)
- **Blocks**: task-epic-11.144.4 (call resolvers need TypeRegistry with resolved data)

## Estimated Effort

- Implementation: 1.5-2 hours
- Testing: 1-1.5 hours
- **Total**: 2.5-3.5 hours
