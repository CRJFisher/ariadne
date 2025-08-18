# Information Architecture Refinement Plan

## Executive Summary

This plan defines a comprehensive strategy for refining the Ariadne repository's information architecture to support both universal language features and language-specific implementations while maintaining a clear hierarchy from user-facing abstractions down to code-facing parsing details.

## Core Architectural Pattern

### Hierarchy Levels (Top to Bottom)

```
User Abstractions (What users want)
    ↓
Programming Concepts (How it's expressed in code)
    ↓
Common Language Feature Processing **OR** Language-Specific Feature Processing (Language-specific syntax/semantics)
    ↓
Parsing Implementation (Tree-sitter queries and AST processing)
```

### Concrete Example

```
"Find all function calls" (User Abstraction)
    ↓
Call Graph Analysis (Programming Concept)
    ↓
- JavaScript: function(), object.method()
- Python: function(), object.method(), @decorator
- Rust: function(), struct::method(), trait::method()
    ↓
Tree-sitter queries for each language's call syntax
```

## Folder Structure Pattern

### Universal Feature Pattern (Case 1)

Features supported across all languages with language-specific variations:

```
src/[feature_category]/[feature]/
├── README.md                              # Feature documentation
├── [feature].ts                           # Core abstraction layer
├── [feature].test.ts                      # Test interface (contract)
├── [feature].javascript.ts                # Language adapter
├── [feature].javascript.test.ts           # Language test implementation
├── [feature].python.ts                    # Language adapter
├── [feature].python.test.ts               # Language test implementation
├── [feature].rust.ts                      # Language adapter
├── [feature].rust.test.ts                 # Language test implementation
└── [feature].typescript.test.ts           # TypeScript shares JS adapter
```

### Language-Specific Feature Pattern (Case 2)

Features unique to specific languages:

```
src/[feature_category]/language_specific/[language]/
├── README.md
├── [feature].ts
└── [feature].test.ts
```

## Technical Solution for Feature→Language→Testing Enforcement

### 1. Test Interface Contracts

Every universal feature must define a contract:

```typescript
// call_graph/function_calls/function_calls.test.ts
export interface FunctionCallsTestContract {
  // Mandatory test cases all languages must implement
  testSimpleFunctionCall(): void;
  testNestedFunctionCall(): void;
  testRecursiveFunctionCall(): void;
  testFunctionCallWithParameters(): void;

  // Optional language-specific extensions
  testLanguageSpecific?(): void;
}

// Base test utilities
export abstract class FunctionCallsTestBase {
  protected createTestProject(code: string): Project {
    /* ... */
  }
  protected assertCallFound(from: string, to: string): void {
    /* ... */
  }
}
```

### 2. Language Adapter Pattern

Each language implements the core abstraction:

```typescript
// call_graph/function_calls/function_calls.ts
export interface FunctionCallDetector {
  detectCalls(ast: ASTNode): CallInfo[];
  resolveTarget(call: CallInfo): ResolvedTarget | null;
}

// call_graph/function_calls/function_calls.javascript.ts
export class JavaScriptFunctionCallDetector implements FunctionCallDetector {
  detectCalls(ast: ASTNode): CallInfo[] {
    // JavaScript-specific implementation
  }
}
```

### 3. Automatic Validation Script

```typescript
// scripts/validate_feature_coverage.ts
interface ValidationResult {
  feature: string;
  contract: string[];
  implementations: {
    javascript: boolean;
    typescript: boolean;
    python: boolean;
    rust: boolean;
  };
  missingTests: string[];
}

function validateFeatureCoverage(): ValidationResult[] {
  // 1. Scan all feature directories
  // 2. Parse test contracts
  // 3. Check for language implementations
  // 4. Verify contract compliance
  // 5. Generate report
}
```

## Incremental Migration Strategy

### Phase 0: Foundation (Week 1)

1. ✅ Create this plan document
2. Create validation scripts
3. Update CLAUDE.md with new patterns
4. Create migration tracking system

### Phase 1: Pilot Migration (Week 2-3)

Select 2-3 features as proof of concept:

**Feature 1: Namespace Imports** (Already partially done)

- Move to `import_resolution/namespace_imports/`
- Create test contract
- Implement for JS/TS/Python/Rust
- Document patterns learned

**Feature 2: Method Chaining**

- High-value feature with complex language differences
- Move to `call_graph/method_chaining/`
- Good test of adapter pattern

**Feature 3: Return Type Analysis**

- Move to `type_system/return_types/`
- Tests type inference patterns

### Phase 2: Documentation Update (Week 3)

1. Archive old documentation:
   - `docs/testing-guide.md` → `docs/archive/`
   - Old feature docs → archive
2. Create new documentation:
   - `docs/ARCHITECTURE.md` - Overall patterns
   - `docs/FEATURE_DEVELOPMENT.md` - How to add features
   - `docs/LANGUAGE_SUPPORT.md` - How to add languages
3. Update rules files:
   - `rules/folder-structure-migration.md` - Already good
   - `rules/testing.md` - Update with contract pattern
   - `rules/refactoring.md` - Add migration guidelines

### Phase 3: Core Feature Migration (Week 4-6)

Migrate high-traffic features in priority order:

1. **Call Graph** (Most complex, highest value)
   - function_calls
   - method_calls
   - cross_file_resolution
2. **Import/Export** (Foundation for other features)
   - basic_imports
   - es6_exports
   - commonjs_exports
3. **Type System** (Builds on call graph)
   - type_inference
   - variable_tracking

### Phase 4: Automation & Enforcement (Week 6-7)

1. CI/CD integration:

   - Pre-commit hook for structure validation
   - GitHub Action for coverage reporting
   - Automated test generation stubs

2. Developer tools:
   - Feature scaffolding generator
   - Language support analyzer
   - Migration progress dashboard

### Phase 5: Complete Migration (Week 8-12)

- Migrate remaining features
- Remove old structure
- Final validation and cleanup

## Success Metrics

1. **Coverage**: All features have test contracts
2. **Parity**: 90%+ test implementation across languages
3. **Documentation**: Every feature has README
4. **Validation**: Zero structure violations in CI
5. **Developer Experience**: Feature discovery < 30 seconds

## Key Terminology

**Feature Category**: Top-level grouping (e.g., call_graph, import_resolution)
**Feature**: Specific capability (e.g., function_calls, namespace_imports)
**Test Contract**: Interface defining required test cases
**Language Adapter**: Implementation bridging core abstraction to language specifics
**Support Level**: Full/Partial/None based on test file existence

## Implementation Checklist

### Immediate Actions (Today)

- [ ] Review and approve this plan
- [ ] Create `scripts/validate_feature_coverage.ts`
- [ ] Update CLAUDE.md with new patterns
- [ ] Select first feature for migration

### Week 1 Actions

- [ ] Complete pilot feature migrations
- [ ] Create feature scaffolding generator
- [ ] Update testing rules documentation
- [ ] Set up migration tracking

### Ongoing Actions

- [ ] Weekly migration progress review
- [ ] Update team on patterns learned
- [ ] Refine validation scripts based on usage
- [ ] Document edge cases and solutions

## Risk Mitigation

1. **Breaking Changes**: Use adapter pattern to maintain backward compatibility
2. **Test Gaps**: Validation script catches missing implementations
3. **Migration Fatigue**: Incremental approach, automate repetitive tasks
4. **Documentation Drift**: Co-locate docs with code, validate in CI

## Appendix: Example Implementations

### A. Test Contract Example

```typescript
// import_resolution/basic_imports/basic_imports.test.ts
export interface BasicImportsTestContract {
  testDefaultImport(): void;
  testNamedImport(): void;
  testNamespaceImport(): void;
  testSideEffectImport(): void;
}

export const BasicImportsTestFixtures = {
  defaultImport: {
    javascript: `import foo from './foo'`,
    python: `import foo`,
    rust: `use foo::Bar`,
  },
};
```

### B. Language Adapter Example

```typescript
// import_resolution/basic_imports/basic_imports.ts
export abstract class BasicImportsResolver {
  abstract resolveImport(node: ImportNode): ResolvedImport;
  abstract getImportedSymbols(import: ResolvedImport): Symbol[];

  // Shared logic
  protected normalizeModulePath(path: string): string {
    // Common path resolution
  }
}
```

### C. Validation Output Example

```
Feature Coverage Report
=======================
✅ call_graph/function_calls
   Contract: 4 required tests
   JavaScript: 4/4 ✅
   TypeScript: 4/4 ✅
   Python: 4/4 ✅
   Rust: 4/4 ✅

⚠️ import_resolution/dynamic_imports
   Contract: 3 required tests
   JavaScript: 3/3 ✅
   TypeScript: 3/3 ✅
   Python: 0/3 ❌ (not supported)
   Rust: 0/3 ❌ (not supported)
```
