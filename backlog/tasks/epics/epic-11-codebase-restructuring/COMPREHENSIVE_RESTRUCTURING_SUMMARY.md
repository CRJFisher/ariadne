# Comprehensive Restructuring Summary - EXISTING Functionality Only

## Executive Summary

This document summarizes the complete plan for restructuring Ariadne's EXISTING 487 functions across 89 source files into a clean, feature-based architecture. **No new features are being added** - this is purely reorganization and refactoring of what already exists.

## What We're Restructuring (EXISTING Only)

### Current State
- **487 exported functions** (all accounted for)
- **89 source files** (all mapped)
- **124 test files** (all reorganized)
- **7 main features** (already in codebase)

### Target State  
- **Same 487 functions** (reorganized by feature)
- **~200 files** (split from monolithic files)
- **~300 test files** (better organized)
- **Same 7 features** (better structured)

## The 7 Existing Features (No New Ones)

1. **Call Graph Analysis** - Detecting and analyzing function/method calls
2. **Scope Resolution** - Building scope trees and resolving references
3. **Import/Export Detection** - Finding and resolving imports/exports
4. **Type Tracking** - Tracking variable and return types
5. **Project Management** - Managing files and providing API
6. **Storage System** - Persisting data
7. **Language Support** - JavaScript, TypeScript, Python, Rust configurations

## Feature-Based Reorganization

### Principle: Universal vs Language-Specific

Each feature is classified as:
- **Universal**: Works the same across all languages (60% of code)
- **Language-Specific**: Different implementation per language (40% of code)

### Example: Call Detection Feature

#### Current Structure (Mixed)
```
src/call_graph/call_detection.ts
  - detect_function_call()  // Has if statements for each language
  - detect_method_call()     // Mixed JS/Python/Rust logic
  - detect_constructor_call() // Different per language
```

#### New Structure (Separated)
```
src/analysis/call_graph/
├── detection/
│   ├── call_detector.ts           // Universal interface
│   ├── javascript/
│   │   ├── function_calls.ts      // JS-specific implementation
│   │   ├── method_calls.ts        // JS prototype methods
│   │   └── constructor_calls.ts   // JS new keyword
│   ├── python/
│   │   ├── function_calls.ts      // Python function calls
│   │   ├── method_calls.ts        // Python method calls
│   │   └── init_calls.ts          // Python __init__
│   └── rust/
│       ├── function_calls.ts      // Rust function calls
│       ├── method_calls.ts        // Rust impl methods
│       └── associated_calls.ts    // Rust associated functions
```

## Critical File Splits (Size Violations)

### Files That MUST Be Split (Approaching 32KB Parser Limit)

| File | Current Size | Split Into | Reason |
|------|--------------|------------|--------|
| src/index.ts | 41KB | 1 main + feature indices | EXCEEDS parser limit |
| src/call_graph/reference_resolution.ts | 28.9KB | 4 files by strategy | Near limit |
| src/call_graph/import_export_detector.ts | 27.4KB | 6 files by language | Near limit |
| src/scope_resolution.ts | 22.3KB | 8 files by responsibility | Monolithic |
| tests/edge_cases.test.ts | 31.3KB | 8 feature tests | Near limit |

### The 457-Line Function That Must Die

`scope_resolution.ts::build_scope_graph()` - 457 lines!

Splits into 6 functions:
1. `collect_scope_nodes()` - Find scope-creating nodes
2. `create_scopes()` - Create scope objects
3. `build_hierarchy()` - Build parent-child relationships
4. `resolve_bindings()` - Connect variables to declarations
5. `handle_hoisting()` - JavaScript-specific hoisting
6. `finalize_graph()` - Final validation

## Test Reorganization

### Current Problems
- Tests scattered across 124 files
- No enforcement of language parity
- Monolithic test files (30+ KB)
- Mixed unit and integration tests

### New Test Structure

#### Test Contracts (Enforce Language Parity)
```typescript
// Every language MUST implement these tests
interface CallDetectionContract {
  test_simple_function_call(): void;
  test_method_call(): void;
  test_constructor_call(): void;
  // ... etc
}
```

#### Test Organization
```
tests/
├── contracts/           // Language parity enforcement
│   └── implementations/
│       ├── javascript/  // JS must implement all contracts
│       ├── python/      // Python must implement all contracts
│       └── rust/        // Rust must implement all contracts
├── unit/               // Feature-specific unit tests
└── integration/        // Cross-feature tests
```

## Stateful to Functional Conversion

### The 23 Stateful Classes That Must Become Functional

Current stateful classes:
1. `Project` class - Mutable file management
2. `ScopeGraph` class - Mutable scope tree
3. `FileManager` class - Mutable file cache
4. ... (20 more)

Example conversion:

```typescript
// CURRENT (Stateful - BAD)
class Project {
  private files: Map<string, File>;
  
  addFile(path: string, content: string): void {
    this.files.set(path, { path, content }); // MUTATION!
  }
}

// NEW (Functional - GOOD)
function addFile(
  project: ProjectState, 
  path: string, 
  content: string
): ProjectState {
  return {
    ...project,
    files: new Map([...project.files, [path, { path, content }]])
  }; // IMMUTABLE!
}
```

## Language-Specific Breakdown

### What's Universal (Works for All Languages)
- Basic scope resolution
- Graph data structures
- File management
- Variable tracking basics
- AST traversal

### JavaScript/TypeScript Specific
- Prototype chain resolution
- `this` binding rules
- Hoisting behavior
- CommonJS modules
- JSX handling

### Python Specific
- Method Resolution Order (MRO)
- `self`/`cls` parameters
- `__init__` constructors
- `__all__` exports
- Decorator handling

### Rust Specific
- Trait method resolution
- `impl` blocks
- `self` vs `Self`
- Module system (`mod`)
- Lifetime tracking (partial)

## Migration Strategy

### Feature Bundles
Migrate related code + tests + docs together:

**Bundle 1: Scope Resolution** (Critical - Week 1)
- Code: `scope_resolution.ts`
- Tests: Scope tests from `edge_cases.test.ts`
- Docs: Scope documentation

**Bundle 2: Import/Export** (High - Week 2)
- Code: `import_export_detector.ts`
- Tests: Import tests
- Docs: Import documentation

**Bundle 3: Type Tracking** (High - Week 3)
- Code: `type_tracker.ts`, `return_type_analyzer.ts`
- Tests: Type tests
- Docs: Type documentation

[... continues for all features]

## What We're NOT Adding

### Features That Don't Exist (NOT ADDING)
- ❌ Control flow analysis
- ❌ Data flow analysis
- ❌ Performance monitoring
- ❌ Error aggregation system
- ❌ CLI interface
- ❌ Configuration management
- ❌ Plugin system
- ❌ Additional languages

These would be NEW features. We're only reorganizing EXISTING features.

## Success Metrics

### Must Achieve
- ✅ All 487 existing functions mapped
- ✅ All files < 32KB
- ✅ Zero stateful classes
- ✅ All functions < 50 lines
- ✅ Test contracts enforce language parity
- ✅ No functionality lost

### Should Achieve
- ✅ Clear feature boundaries
- ✅ Better test organization
- ✅ Improved documentation
- ✅ Easier to maintain

## File Count Summary

### Source Files
- **Current**: 89 files (some huge)
- **Target**: ~200 files (all < 30KB)
- **Reason**: Splitting monolithic files

### Test Files
- **Current**: 124 files (poorly organized)
- **Target**: ~300 files (feature-organized)
- **Reason**: Better organization + contracts

### Total Impact
- **Current**: 213 total files
- **Target**: ~500 total files
- **But**: Same functionality, better organized

## Timeline

### Week 1-2: Foundation
- Set up new directory structure
- Create test contracts
- Begin scope resolution migration

### Week 3-4: Core Features
- Migrate import/export detection
- Migrate type tracking
- Start call graph migration

### Week 5-6: Call Graph
- Complete call graph migration
- Migrate reference resolution
- Update method resolution

### Week 7-8: Project Layer
- Refactor Project class to functional
- Update all project operations
- Create compatibility wrapper

### Week 9-10: Finalization
- Complete test migration
- Update all documentation
- Final validation

## Conclusion

This restructuring:
- **Reorganizes** existing functionality (doesn't add new)
- **Splits** monolithic files (doesn't change behavior)
- **Separates** language-specific code (doesn't alter logic)
- **Enforces** language parity (doesn't add features)
- **Improves** maintainability (doesn't change API yet)

The goal is a cleaner, more maintainable codebase with the SAME functionality, just better organized.