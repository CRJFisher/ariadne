# Functionality Dependencies Map

## Core Dependency Graph

```
Project (root)
├── Storage System (foundational)
│   ├── Storage Interface
│   └── In-Memory Storage
├── Language Manager (foundational)
│   └── Language Configurations
├── File Manager (foundational)
│   ├── Source extraction
│   └── AST parsing
├── Scope Resolution (critical)
│   ├── Scope tree building
│   └── Reference resolution
├── Import/Export Detection (critical)
│   ├── Import resolver
│   └── Module resolver
├── Type System (important)
│   ├── Type tracker
│   └── Return type analyzer
├── Call Graph Analysis (core feature)
│   ├── Call detection
│   ├── Method resolution
│   ├── Constructor analysis
│   └── Reference resolution
├── Graph Builder (integration)
│   ├── Two-phase building
│   └── Project graph data
└── Services (API layer)
    ├── Call graph service
    └── Inheritance service
```

## Critical Dependencies

### Level 0 (No Dependencies)
These must work first:
- Storage Interface
- Language Configurations
- Tree-sitter Parsing

### Level 1 (Foundation)
Depends on Level 0:
- File Manager
- Language Manager
- In-Memory Storage

### Level 2 (Core Infrastructure)
Depends on Level 1:
- Scope Resolution
- Import/Export Detection
- AST Querying

### Level 3 (Analysis Features)
Depends on Level 2:
- Type Tracker
- Call Detection
- Method Resolution

### Level 4 (Integration)
Depends on Level 3:
- Graph Builder
- Call Graph Service
- Project API

## Module-Level Dependencies

### Project Class
**Depends On**:
- File Manager (manages files)
- Language Manager (language detection)
- Call Graph Service (analysis)
- Storage System (persistence)
- Import Resolver (module resolution)

**Used By**:
- All public API functions
- MCP server
- CLI tools

### File Manager
**Depends On**:
- Language Manager (language detection)
- Source extraction (get code)
- Tree-sitter (parsing)

**Used By**:
- Project class
- Call graph analysis
- All services

### Call Graph Analysis
**Depends On**:
- Scope Resolution (find definitions)
- Type Tracker (track types)
- Import Resolver (resolve imports)
- Method Resolution (resolve methods)

**Used By**:
- Graph Builder
- Call Graph Service
- Public API

### Type Tracker
**Depends On**:
- Scope Resolution (scope chain)
- Import Resolver (imported types)
- Return Type Analyzer (inference)

**Used By**:
- Call Graph Analysis
- Method Resolution
- Reference Resolution

### Import/Export Detector
**Depends On**:
- AST Querying (find imports/exports)
- Module Resolver (path resolution)
- Language-specific patterns

**Used By**:
- Import Resolver
- Reference Resolution
- Type Tracker

### Graph Builder
**Depends On**:
- Call Graph Analysis (get calls)
- Type Tracker (type info)
- Project Graph Data (data structure)
- All file data

**Used By**:
- Call Graph Service
- Project.get_call_graph()

## Circular Dependencies (TO FIX)

### Problem 1: Reference Resolution ↔ Type Tracker
- Reference resolution needs types to resolve
- Type tracker needs resolution for imports
- **Solution**: Two-pass approach

### Problem 2: Method Resolution ↔ Inheritance Service  
- Method resolution needs inheritance chain
- Inheritance needs method definitions
- **Solution**: Lazy evaluation

### Problem 3: Import Resolver ↔ File Manager
- Import resolver needs file contents
- File manager needs imports for dependencies
- **Solution**: Separate concerns

## Migration Order (Based on Dependencies)

### Phase 1: Foundation (No Dependencies)
1. Storage System
2. Language Configurations
3. Constants & Types
4. Utilities

### Phase 2: File Management
1. File Manager
2. Language Manager
3. Source Utilities
4. Query Utilities

### Phase 3: Core Analysis
1. Scope Resolution
2. Import/Export Detection
3. Module Resolver
4. Import Resolver (project-level)

### Phase 4: Type System
1. Type Tracker
2. Return Type Analyzer
3. Type-related utilities

### Phase 5: Call Graph Core
1. Call Detection
2. Constructor Analysis
3. Method Resolution
4. Reference Resolution

### Phase 6: Integration
1. Graph Builder
2. Project Graph Data
3. Call Graph Service
4. Inheritance Service

### Phase 7: API Layer
1. Project Class
2. Public API (index.ts)
3. Type exports

## Test Dependencies

### Test Execution Order
1. **Unit Tests** (no dependencies)
   - Storage tests
   - Utility tests
   - Type tests

2. **Integration Tests** (need multiple modules)
   - Scope resolution tests
   - Import/export tests
   - Type tracking tests

3. **End-to-End Tests** (need full system)
   - Call graph tests
   - Cross-file tests
   - Language-specific tests

### Test Data Dependencies
- Test fixtures depend on language support
- Language tests depend on test utilities
- Integration tests depend on test projects

## Feature Flag Dependencies

For safe migration, features can be flagged:

### Independent Features (can be flagged)
- Storage backends
- Language support
- Analysis features
- API endpoints

### Coupled Features (must migrate together)
- Call detection + Method resolution
- Type tracking + Return types
- Import detection + Module resolution
- Scope building + Reference resolution

## Performance Dependencies

### Performance-Critical Paths
1. **Parse Path**: File → AST → Scope tree
2. **Resolution Path**: Reference → Scope → Definition
3. **Analysis Path**: AST → Calls → Graph
4. **Type Path**: Variable → Type → Resolution

### Optimization Dependencies
- Caching depends on immutable data
- Incremental updates depend on graph structure
- Parallel processing depends on independent modules
- Lazy evaluation depends on clear boundaries

## Breaking Change Dependencies

### Changes That Break Everything
1. Scope tree structure change
2. AST node format change
3. Storage interface change
4. Core type definitions change

### Changes With Limited Impact
1. Adding new languages
2. Adding analysis features
3. Adding storage backends
4. Adding API endpoints

## Documentation Dependencies

### Documentation Build Order
1. Architecture overview (no deps)
2. Core concepts (depends on architecture)
3. API reference (depends on implementation)
4. Examples (depends on API)
5. Tutorials (depends on examples)

## Risk Matrix

| Component | Dependencies | Risk Level | Migration Complexity |
|-----------|--------------|------------|---------------------|
| Storage System | None | LOW | Simple |
| File Manager | Language Manager | LOW | Simple |
| Scope Resolution | AST, File Manager | HIGH | Complex |
| Type Tracker | Scope, Imports | HIGH | Complex |
| Call Graph | Everything | CRITICAL | Very Complex |
| Project Class | Everything | CRITICAL | Very Complex |

## Dependency Injection Points

For easier testing and migration:

### Current Injection Points
- Storage (via interface)
- Language config (via manager)

### Needed Injection Points
- Scope resolver (currently static)
- Type tracker (currently static)
- Import resolver (partially injected)
- Call analyzer (currently static)

## Migration Strategy

### Safe Migration Order
1. Start with leaf nodes (no dependencies)
2. Move up one level at a time
3. Maintain parallel old/new during transition
4. Validate at each level
5. Cut over when complete level works

### Risky But Fast
1. Rewrite core abstractions first
2. Force everything to adapt
3. Fix breaks as they occur
4. High risk, high reward

### Recommended: Hybrid
1. Safe migration for critical paths
2. Fast migration for independent features
3. Parallel development where possible
4. Incremental validation throughout