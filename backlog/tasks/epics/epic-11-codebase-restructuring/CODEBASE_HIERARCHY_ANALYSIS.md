# Codebase Hierarchy Analysis

## Current Codebase Structure (As Implemented)

### src/

- **project/** - Manages files and language detection
  - `Project` - Main API for file and graph operations
  - `file_manager` - Tracks files and incremental updates
  - `language_manager` - Maps file extensions to parsers
  - `import_resolver` - Resolves imports across project files
  - `call_graph_service` - Builds call graphs for project
  - `inheritance_service` - Tracks class inheritance relationships
- **call_graph/** - Analyzes function and method calls
  - **call_analysis/** - Core call detection and resolution
    - `core` - Analyzes calls and builds graphs
    - `call_detection` - Detects function/method/constructor calls
    - `method_resolution` - Resolves methods to classes
    - `reference_resolution` - Resolves variables to definitions
    - `constructor_analysis` - Tracks constructor calls
    - `range_utils` - Finds enclosing functions for nodes
  - `import_export_detector` - Detects imports and exports
  - `type_tracker` - Tracks variable and return types
  - `return_type_analyzer` - Infers function return types
  - `graph_builder` - Two-phase graph construction
  - `project_graph_data` - Immutable graph data structure
- **import_resolution/** - Resolves namespace imports
  - `index` - Dispatches to language handlers
  - `namespace_imports` - Common namespace resolution logic
  - `namespace_imports.javascript` - JS/TS namespace handling
  - `namespace_imports.python` - Python namespace handling
  - `namespace_imports.rust` - Rust namespace handling
- **storage/** - Pluggable storage backends
  - `storage_interface` - Abstract storage contract
  - `in_memory_storage` - Default RAM storage
  - **examples/** - Example implementations
    - `disk_storage` - Persistent file storage
- **languages/** - Language-specific scope queries
  - **javascript/** - JS scope patterns
  - **typescript/** - TS scope patterns
  - **python/** - Python scope patterns
  - **rust/** - Rust scope patterns
- **utils/** - Shared utility functions
  - `query_utils` - Tree-sitter query execution
  - `source_utils` - Source code manipulation
- `scope_resolution` - Resolves references in scopes
- `module_resolver` - Resolves module paths
- `index` - Public API exports (41KB - TOO LARGE)

### tests/

- **Language tests** - Language-specific test suites
- **Feature tests** - Call graph, imports, types
- **Integration tests** - Cross-file, edge cases
- **Regression tests** - Specific bug fixes
- **Performance tests** - Benchmarks and profiling

## Improved Conceptual Hierarchy

### Rationale for Improvements

The current structure mixes concerns and creates unclear dependencies. The improved hierarchy follows these principles:

1. **Separation of User Features from Implementation** - Top-level features that users care about vs internal mechanisms
2. **Clear Data Flow** - From source files → parsing → analysis → results
3. **Language Abstraction** - Centralize language-specific logic instead of scattering it
4. **Single Responsibility** - Each module has one clear purpose
5. **Dependency Direction** - Dependencies flow downward, no circular refs

### Proposed Structure

#### 1. High-Level Features (Core Analysis Capabilities)

- **call_graph/** - Find what calls what
  - `function_calls` - Track function invocations
  - `method_calls` - Track method invocations
  - `constructor_calls` - Track object instantiation
  - `call_chain_analysis` - Follow call paths
- **import_export/** - Resolve module dependencies
  - `import_resolution` - Find import targets
  - `export_detection` - Find exported symbols
  - `namespace_resolution` - Resolve namespace members
  - `module_graph` - Build dependency graph
- **type_analysis/** - Track and infer types
  - `type_tracking` - Track variable types
  - `return_type_inference` - Infer function returns
  - `parameter_type_inference` - Infer parameter types
  - `type_propagation` - Flow types through code
- **scope_analysis/** - Resolve symbols in scopes
  - `scope_tree` - Build scope hierarchies
  - `symbol_resolution` - Resolve references
  - `definition_finder` - Find symbol definitions
  - `usage_finder` - Find symbol usages
- **inheritance_analysis/** - Track class relationships
  - `class_hierarchy` - Build inheritance trees
  - `method_override` - Track overridden methods
  - `interface_implementation` - Track interface impls

#### 2. Data Layer (Storage and Management)

- **project/** - Project-level coordination
  - `project_manager` - Coordinate all features
  - `file_tracker` - Track file changes
  - `incremental_updates` - Handle file updates
- **storage/** - Data persistence layer
  - `storage_interface` - Storage abstraction
  - `memory_storage` - In-memory storage
  - `disk_storage` - File-based storage
  - `cache_layer` - Query result caching
- **graph/** - Graph data structures
  - `graph_builder` - Construct graphs
  - `graph_data` - Immutable graph storage
  - `graph_algorithms` - Graph traversal/search

#### 3. Foundation (Core Infrastructure)

- ~~**scope_queries/**~~ ✅ **MIGRATED to scope_analysis/scope_tree/queries/** - Tree-sitter query patterns (per Architecture.md)
  - `loader` - Central loader and file extension mapping
  - `javascript.scm` - JavaScript scope patterns
  - `javascript.meta.json` - Symbol kinds and capture mappings
  - `typescript.scm` - TypeScript scope patterns
  - `typescript.meta.json` - Symbol kinds and capture mappings
  - `python.scm` - Python scope patterns
  - `python.meta.json` - Symbol kinds and capture mappings
  - `rust.scm` - Rust scope patterns
  - `rust.meta.json` - Symbol kinds and capture mappings
- **ast/** - AST processing utilities
  - `node_utils` - AST node helpers
  - `query_executor` - Run tree-sitter queries
  - `position_utils` - Handle positions/ranges
- **utils/** - General utilities
  - `path_utils` - Path manipulation
  - `string_utils` - String processing
  - `collection_utils` - Data structure helpers

#### 4. API Layer

- `index.ts` - Single entry point exporting user-facing APIs (no logic, exports only)

### Migration Benefits

1. **Clearer Mental Model** - Features at top, implementation details below
2. **Better Testability** - Each layer can be tested independently
3. **Easier Language Addition** - All language logic in one place
4. **Reduced Coupling** - Clear interfaces between layers
5. **Simpler Navigation** - Find code by feature not implementation
6. **Better Documentation** - Structure matches user concepts
7. **Parallel Development** - Teams can work on layers independently

### Migration Strategy

1. **Phase 1: Rename and Create** - Rename `packages/core/src` to `packages/core/src_old`, create new `src` folder
2. **Phase 2: Set Up Structure** - Create all folders for the new hierarchy
3. **Phase 3: Move Features** - Migrate each feature with its language-specific implementations
4. **Phase 4: Move Data Layer** - Migrate storage, project, and graph management
5. **Phase 5: Move Foundation** - Migrate utilities and infrastructure
6. **Phase 6: Clean Up** - Remove src_old, update imports, verify all tests pass

**Note**: All types remain in `packages/types` - no type definitions in the core package.
