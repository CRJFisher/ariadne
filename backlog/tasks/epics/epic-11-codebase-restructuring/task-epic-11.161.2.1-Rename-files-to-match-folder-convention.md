# Task 11.161.2.1: Rename Files to Match Folder Convention

## Status: Planning

## Parent: Task 11.161.2

## Goal

Rename all files where the main module name doesn't match the folder name, per the folder-module naming rule documented in `file-naming-conventions.md`.

## Convention Summary

```text
{folder}/
  {folder}.ts                              # Main implementation
  {folder}.test.ts                         # Unit tests
  {folder}.{language}.ts                   # Language-specific variant
  {folder}.{language}.{submodule}.ts       # Language + sub-split
```

## Renames Required

### 1. index_single_file/

| Current | New |
|---------|-----|
| `semantic_index.ts` | `index_single_file.ts` |
| `semantic_index.typescript.test.ts` | `index_single_file.typescript.test.ts` |
| `semantic_index.javascript.test.ts` | `index_single_file.javascript.test.ts` |
| `semantic_index.python.test.ts` | `index_single_file.python.test.ts` |
| `semantic_index.rust.test.ts` | `index_single_file.rust.test.ts` |

### 2. resolve_references/

| Current | New |
|---------|-----|
| `resolution_registry.ts` | `resolve_references.ts` |
| `resolution_registry.test.ts` | `resolve_references.test.ts` |

### 3. trace_call_graph/

| Current | New |
|---------|-----|
| `detect_call_graph.ts` | `trace_call_graph.ts` |

### 4. definitions/

| Current | New |
|---------|-----|
| `definition_builder.ts` | `definitions.ts` |
| `definition_builder.test.ts` | `definitions.test.ts` |

### 5. references/

| Current | New |
|---------|-----|
| `reference_builder.ts` | `references.ts` |
| `reference_builder.test.ts` | `references.test.ts` |
| `reference_factories.ts` | `references.factories.ts` |
| `reference_factories.test.ts` | `references.factories.test.ts` |

### 6. import_resolution/

| Current | New |
|---------|-----|
| `import_resolver.ts` | `import_resolution.ts` |
| `import_resolver.typescript.ts` | `import_resolution.typescript.ts` |
| `import_resolver.javascript.ts` | `import_resolution.javascript.ts` |
| `import_resolver.python.ts` | `import_resolution.python.ts` |
| `import_resolver.rust.ts` | `import_resolution.rust.ts` |
| `import_resolver.typescript.test.ts` | `import_resolution.typescript.test.ts` |
| `import_resolver.javascript.test.ts` | `import_resolution.javascript.test.ts` |
| `import_resolver.python.test.ts` | `import_resolution.python.test.ts` |
| `import_resolver.rust.test.ts` | `import_resolution.rust.test.ts` |

### 7. scopes/

| Current | New |
|---------|-----|
| `scope_processor.ts` | `scopes.ts` |
| `scope_processor.test.ts` | `scopes.test.ts` |
| `scope_boundary_extractor.ts` | `scopes.boundary_extractor.ts` |
| `scope_boundary_extractor.test.ts` | `scopes.boundary_extractor.test.ts` |
| `scope_boundary_extractor.integration.test.ts` | `scopes.boundary_extractor.integration.test.ts` |
| `scope_boundary_base.ts` | `scopes.boundary_base.ts` |
| `scope_boundary_base.test.ts` | `scopes.boundary_base.test.ts` |
| `scope_utils.ts` | `scopes.utils.ts` |
| `scope_utils.test.ts` | `scopes.utils.test.ts` |

### 8. call_resolution/

| Current | New |
|---------|-----|
| `constructor_resolver.ts` | `call_resolution.constructor.ts` |
| `method_resolver.ts` | `call_resolution.method.ts` |
| `method_resolver.test.ts` | `call_resolution.method.test.ts` |
| `self_reference_resolver.ts` | `call_resolution.self_reference.ts` |
| `self_reference_resolver.test.ts` | `call_resolution.self_reference.test.ts` |
| `self_reference_resolution.integration.test.ts` | `call_resolution.self_reference.integration.test.ts` |
| `collection_dispatch_resolver.ts` | `call_resolution.collection_dispatch.ts` |

### 9. registries/

| Current | New |
|---------|-----|
| `definition_registry.ts` | `registries.definition.ts` |
| `definition_registry.test.ts` | `registries.definition.test.ts` |
| `export_registry.ts` | `registries.export.ts` |
| `reference_registry.ts` | `registries.reference.ts` |
| `scope_registry.ts` | `registries.scope.ts` |
| `scope_registry.test.ts` | `registries.scope.test.ts` |
| `type_registry.ts` | `registries.type.ts` |
| `type_registry.test.ts` | `registries.type.test.ts` |

### 10. type_preprocessing/

| Current | New |
|---------|-----|
| `alias_extraction.ts` | `type_preprocessing.alias.ts` |
| `alias_extraction.test.ts` | `type_preprocessing.alias.test.ts` |
| `constructor_tracking.ts` | `type_preprocessing.constructor.ts` |
| `constructor_tracking.test.ts` | `type_preprocessing.constructor.test.ts` |
| `member_extraction.ts` | `type_preprocessing.member.ts` |
| `member_extraction.test.ts` | `type_preprocessing.member.test.ts` |
| `type_bindings.ts` | `type_preprocessing.bindings.ts` |
| `type_bindings.test.ts` | `type_preprocessing.bindings.test.ts` |

## Directories Already Compliant

| Directory | Main Module | Status |
|-----------|-------------|--------|
| `project/` | `project.ts` | Compliant |
| `query_code_tree/` | `query_code_tree.ts` | Compliant |
| `capture_handlers/` | `capture_handlers.{lang}.ts` | Compliant (no main needed) |
| `metadata_extractors/` | `metadata_extractors.{lang}.ts` | Compliant (no main needed) |
| `symbol_factories/` | `symbol_factories.{lang}.ts` | Compliant (no main needed) |
| `extractors/` | `{lang}_scope_boundary_extractor.ts` | Exception (prefix pattern) |

## Implementation Strategy

1. **Order**: Rename leaf directories first, then work up to top-level
2. **Per directory**:
   - Use `git mv` to rename files
   - Update all imports in the codebase
   - Update barrel files (`index.ts`)
   - Run tests to verify
3. **Commit**: One commit per directory rename for easier rollback

## Import Migration

Each rename requires updating imports across the codebase. Use search/replace:

```bash
# Example for semantic_index → index_single_file
git grep -l "semantic_index" | xargs sed -i '' 's/semantic_index/index_single_file/g'
```

## Success Criteria

1. All main modules match their folder names
2. All imports updated correctly
3. All tests pass
4. No broken exports
