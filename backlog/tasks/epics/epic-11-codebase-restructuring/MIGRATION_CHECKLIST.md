# Migration Checklist

## Pre-Migration Setup

### Environment Preparation
- [ ] Create feature branch: `feat/architecture-migration`
- [ ] Set up parallel directory structure
- [ ] Configure build tools for new structure
- [ ] Set up test runners for new structure
- [ ] Create rollback tags in git
- [ ] Document current performance benchmarks
- [ ] Create migration tracking spreadsheet
- [ ] Set up CI/CD for parallel testing

### Tooling Setup
- [ ] Install jscodeshift for codemods
- [ ] Configure ESLint for snake_case enforcement
- [ ] Set up file size checker (max 30KB warning)
- [ ] Create import update scripts
- [ ] Set up complexity analyzer
- [ ] Configure test coverage tracking
- [ ] Create validation scripts

## Phase 0: Prerequisites (Week 1)

### Directory Structure Creation
- [ ] Create src/core/ hierarchy
- [ ] Create src/storage/ structure  
- [ ] Create src/languages/ structure
- [ ] Create src/parsing/ structure
- [ ] Create src/analysis/ structure
- [ ] Create src/project/ structure
- [ ] Create src/utils/ structure
- [ ] Create tests/ new structure

### Foundation Files
- [ ] Create core/types/ast.ts
- [ ] Create core/types/graph.ts
- [ ] Create core/types/language.ts
- [ ] Create core/constants/limits.ts (MAX_FILE_SIZE = 30KB)
- [ ] Create core/errors/ types
- [ ] Create all index.ts barrel exports
- [ ] Create test contract interfaces

### Compatibility Layer
- [ ] Create temporary facade pattern
- [ ] Set up import aliases
- [ ] Create deprecation warnings
- [ ] Document migration paths
- [ ] Create adapter functions

## Phase 1: Foundation Migration (Week 2)

### Core Types (No dependencies)
- [ ] Migrate type definitions to core/types/
- [ ] Update all type imports
- [ ] Verify no circular dependencies
- [ ] Run type checking
- [ ] Update tests

### Storage System
- [ ] Move storage/storage_interface.ts (no change)
- [ ] Move storage/in_memory_storage.ts (no change)
- [ ] Move storage/examples/ (no change)
- [ ] Update storage imports
- [ ] Run storage tests
- [ ] Verify storage functionality

### Language Configurations
- [ ] Reorganize languages/javascript/
- [ ] Reorganize languages/typescript/
- [ ] Reorganize languages/python/
- [ ] Reorganize languages/rust/
- [ ] Create language contracts
- [ ] Update language imports
- [ ] Test language detection

### Utilities Migration
- [ ] Create utils/ast/ from query_utils.ts
- [ ] Create utils/source/ from source_utils.ts
- [ ] Create utils/path/ utilities
- [ ] Ensure all utils are pure functions
- [ ] Remove any side effects
- [ ] Update utility imports
- [ ] Test utility functions

## Phase 2: Parsing Layer (Week 3)

### Parser Setup
- [ ] Create parsing/parser/tree_sitter_parser.ts
- [ ] Extract parser logic from various files
- [ ] Create parser cache
- [ ] Remove parser side effects
- [ ] Test parser functionality

### AST Utilities
- [ ] Create parsing/ast_utils/node_visitor.ts
- [ ] Create parsing/ast_utils/node_finder.ts
- [ ] Create parsing/ast_utils/text_extractor.ts
- [ ] Ensure immutable operations
- [ ] Update AST utility imports
- [ ] Test AST operations

## Phase 3: Scope Analysis (Week 4)

### CRITICAL: Split scope_resolution.ts (22.3KB)

#### Scope Builder Extraction
- [ ] Create analysis/scope/builder/scope_builder.ts
- [ ] Extract build_scope_graph() (457 lines) and split into:
  - [ ] collect_scope_nodes() (~50 lines)
  - [ ] create_scopes() (~50 lines)
  - [ ] build_hierarchy() (~50 lines)
  - [ ] resolve_bindings() (~50 lines)
  - [ ] finalize_graph() (~50 lines)
- [ ] Create scope_tree_builder.ts
- [ ] Create node_visitor.ts
- [ ] Create scope_factory.ts
- [ ] Remove all mutations (push, etc.)
- [ ] Test scope building

#### Scope Resolver Extraction
- [ ] Create analysis/scope/resolver/scope_resolver.ts
- [ ] Extract resolve_reference logic
- [ ] Create reference_finder.ts
- [ ] Create chain_walker.ts
- [ ] Create binding_resolver.ts
- [ ] Make all operations immutable
- [ ] Test scope resolution

#### Scope Models
- [ ] Create models/scope.ts (immutable)
- [ ] Create models/scope_graph.ts (immutable)
- [ ] Convert ScopeGraph class to functions
- [ ] Create models/scope_node.ts
- [ ] Test models

#### Validation
- [ ] All scope files < 10KB
- [ ] No stateful classes
- [ ] All functions < 50 lines
- [ ] Full test coverage
- [ ] Performance benchmark

## Phase 4: Import/Export System (Week 5)

### CRITICAL: Split import_export_detector.ts (27.4KB)

#### ES6 Imports
- [ ] Create imports/detection/es6/import_detector.ts
- [ ] Create imports/detection/es6/export_detector.ts
- [ ] Create imports/detection/es6/es6_patterns.ts
- [ ] Extract ES6-specific logic
- [ ] Test ES6 detection

#### CommonJS
- [ ] Create imports/detection/commonjs/require_detector.ts
- [ ] Create imports/detection/commonjs/module_exports_detector.ts
- [ ] Create imports/detection/commonjs/commonjs_patterns.ts
- [ ] Extract CommonJS logic
- [ ] Test CommonJS detection

#### Language-Specific
- [ ] Create imports/detection/language_specific/python_imports.ts
- [ ] Create imports/detection/language_specific/rust_imports.ts
- [ ] Extract language-specific logic
- [ ] Test language imports

#### Resolution
- [ ] Migrate module_resolver.ts
- [ ] Migrate path resolution logic
- [ ] Create import cache
- [ ] Test resolution

## Phase 5: Type System (Week 6)

### Type Tracking
- [ ] Create types/tracking/variable_types/
- [ ] Split type_tracker.ts (20.4KB) into:
  - [ ] variable_tracker.ts
  - [ ] reassignment_handler.ts
  - [ ] scope_types.ts
- [ ] Create types/tracking/return_types/
- [ ] Create types/tracking/parameter_types/
- [ ] Remove mutations
- [ ] Test type tracking

### Type Inference
- [ ] Create types/inference/basic/
- [ ] Create types/inference/advanced/
- [ ] Migrate return_type_analyzer.ts
- [ ] Implement missing inference
- [ ] Test inference

## Phase 6: Call Graph Core (Week 7-8)

### CRITICAL: Split reference_resolution.ts (28.9KB)

#### Reference Resolution
- [ ] Create resolution/reference/ directory
- [ ] Split into:
  - [ ] variable_resolver.ts (~7KB)
  - [ ] import_resolver.ts (~7KB)
  - [ ] property_resolver.ts (~7KB)
  - [ ] parameter_resolver.ts (~7KB)
- [ ] Implement strategy pattern
- [ ] Remove long functions
- [ ] Test resolution

#### Call Detection
- [ ] Create detection/function_calls/
- [ ] Create detection/method_calls/
- [ ] Create detection/constructor_calls/
- [ ] Implement language-specific versions
- [ ] Create test contracts
- [ ] Test detection

#### Graph Building
- [ ] Split graph_builder.ts (21.8KB)
- [ ] Create building/graph_builder.ts
- [ ] Create building/edge_creator.ts
- [ ] Create building/node_creator.ts
- [ ] Create building/graph_merger.ts
- [ ] Test graph building

## Phase 7: Project Refactoring (Week 9)

### CRITICAL: Convert Project Class

#### Immutable State
- [ ] Create project/state/project_state.ts
- [ ] Create project/state/file_state.ts
- [ ] Create project/state/state_transitions.ts
- [ ] Define immutable interfaces
- [ ] Test state management

#### Pure Operations
- [ ] Create project/operations/file_operations.ts
- [ ] Convert add_file() to pure function
- [ ] Convert update_file() to pure function
- [ ] Convert remove_file() to pure function
- [ ] Create project/operations/analysis_operations.ts
- [ ] Convert get_call_graph() to pure function
- [ ] Test operations

#### Compatibility Wrapper
- [ ] Create project/api/project.ts
- [ ] Implement adapter pattern
- [ ] Maintain backward compatibility
- [ ] Add deprecation warnings
- [ ] Test compatibility

## Phase 8: Cleanup (Week 10)

### File Cleanup
- [ ] Delete old scope_resolution.ts
- [ ] Delete old call_graph files
- [ ] Delete old project files
- [ ] Clean up imports
- [ ] Remove temporary adapters

### Test Migration
- [ ] Split edge_cases.test.ts (31.3KB)
- [ ] Split javascript_core_features.test.ts (30.8KB)
- [ ] Split call_graph.test.ts (29.7KB)
- [ ] Reorganize test structure
- [ ] Update test imports
- [ ] Verify all tests pass

### Documentation
- [ ] Update README.md
- [ ] Update API documentation
- [ ] Update architecture diagrams
- [ ] Create migration guide
- [ ] Document breaking changes

### Final Validation
- [ ] Run full test suite
- [ ] Check file sizes (all < 30KB)
- [ ] Verify no stateful classes
- [ ] Check function complexity
- [ ] Run performance benchmarks
- [ ] Verify < 10% regression

## Post-Migration

### Performance Optimization
- [ ] Profile critical paths
- [ ] Optimize hot spots
- [ ] Add caching where needed
- [ ] Parallel processing setup
- [ ] Memory optimization

### Automation Setup
- [ ] Configure pre-commit hooks
- [ ] Set up file size checks
- [ ] Enable complexity checks
- [ ] Automate style enforcement
- [ ] Set up continuous monitoring

### Team Enablement
- [ ] Conduct architecture review
- [ ] Create developer guide
- [ ] Hold training sessions
- [ ] Document best practices
- [ ] Set up code review guidelines

## Validation Gates

### Per-Phase Validation
Each phase must pass before proceeding:
- [ ] All tests passing
- [ ] No circular dependencies
- [ ] File sizes within limits
- [ ] Complexity metrics met
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated

### Per-File Validation
Each migrated file must:
- [ ] Be under 30KB (hard limit)
- [ ] Have no stateful classes
- [ ] Use snake_case naming
- [ ] Have functions < 50 lines
- [ ] Have test coverage
- [ ] Be documented

## Rollback Procedures

### Phase Rollback
If a phase fails:
1. [ ] Stop all migration work
2. [ ] Identify failure cause
3. [ ] Revert to phase start tag
4. [ ] Fix issues
5. [ ] Restart phase

### Emergency Rollback
If critical failure:
1. [ ] Alert team
2. [ ] Revert to main branch
3. [ ] Restore from backup
4. [ ] Investigate root cause
5. [ ] Create fix plan

## Success Criteria

### Must Have (Migration Fails Without)
- [ ] All files < 32KB
- [ ] All tests passing
- [ ] No breaking API changes
- [ ] < 10% performance regression

### Should Have (Migration Degraded Without)
- [ ] All files < 20KB
- [ ] Zero stateful classes
- [ ] Complete test contracts
- [ ] Full documentation

### Nice to Have (Future Improvements)
- [ ] All files < 10KB
- [ ] Property-based tests
- [ ] Visual architecture docs
- [ ] Automated refactoring tools

## Sign-off

### Technical Review
- [ ] Architecture lead approval
- [ ] Performance acceptable
- [ ] Security review passed
- [ ] Code quality metrics met

### Business Review
- [ ] No feature regressions
- [ ] Migration timeline met
- [ ] Documentation complete
- [ ] Team trained

### Final Approval
- [ ] All phases complete
- [ ] All validations passed
- [ ] Rollback plan tested
- [ ] Ready for production