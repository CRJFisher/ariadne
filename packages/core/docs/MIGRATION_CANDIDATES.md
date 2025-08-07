# Migration Candidates for Proof of Concept

## Selection Criteria

Features selected for initial migration should:
1. Be relatively self-contained
2. Have clear language differences to test adapter pattern
3. Provide immediate value to demonstrate the new structure
4. Have existing tests to validate migration correctness

## Recommended Migration Order

### Phase 1: Foundation Features (Week 1)

#### 1. ✅ Namespace Imports (PARTIALLY COMPLETE)
**Location**: `src/import_resolution/namespace_imports/`
**Status**: Structure created, needs contract and remaining languages
**Why**: Already started, good template for others
**Next Steps**:
- Create formal test contract
- Add Python and Rust implementations
- Document patterns learned

#### 2. Method Chaining
**Current**: Scattered in call analysis
**Target**: `src/call_graph/method_chaining/`
**Why**: 
- Clear feature boundary
- Complex language differences (optional chaining, Rust iterators)
- High value for users
**Complexity**: Medium

#### 3. Basic Imports
**Current**: Part of import/export detector
**Target**: `src/import_resolution/basic_imports/`
**Why**:
- Fundamental feature
- Well-understood patterns
- Good test of contract system
**Complexity**: Low

### Phase 2: Core Features (Week 2)

#### 4. Function Calls
**Current**: `src/call_graph/call_analysis/`
**Target**: `src/call_graph/function_calls/`
**Why**:
- Core feature used by many others
- Clear abstraction
- Language differences in syntax
**Complexity**: Medium

#### 5. Return Types
**Current**: `src/call_graph/return_type_analyzer.ts`
**Target**: `src/type_system/return_types/`
**Why**:
- Tests type system category
- Complex inference logic
- Language-specific type systems
**Complexity**: High

#### 6. ES6/CommonJS Exports
**Current**: `src/call_graph/import_export_detector.ts`
**Target**: `src/export_detection/es6_exports/` and `/commonjs_exports/`
**Why**:
- JavaScript-specific but critical
- Clear separation of concerns
- Tests language-specific features
**Complexity**: Medium

### Phase 3: Advanced Features (Week 3)

#### 7. Class Inheritance
**Current**: `src/inheritance.ts`
**Target**: `src/inheritance/class_inheritance/`
**Why**:
- Complex cross-language differences
- Tests inheritance category
- Important for OOP codebases
**Complexity**: High

#### 8. Variable Type Tracking
**Current**: `src/call_graph/type_tracker.ts`
**Target**: `src/type_system/variable_tracking/`
**Why**:
- Complex feature
- Heavy language differences
- Tests advanced patterns
**Complexity**: Very High

## Migration Priority Matrix

| Feature | Value | Complexity | Risk | Priority |
|---------|-------|------------|------|----------|
| Namespace Imports | High | Low | Low | 1 |
| Method Chaining | High | Medium | Low | 2 |
| Basic Imports | High | Low | Low | 3 |
| Function Calls | Very High | Medium | Medium | 4 |
| Return Types | Medium | High | Medium | 5 |
| ES6/CommonJS Exports | High | Medium | Low | 6 |
| Class Inheritance | Medium | High | Medium | 7 |
| Variable Type Tracking | Medium | Very High | High | 8 |

## Implementation Strategy for Each Feature

### Namespace Imports (Continue Current Work)

```bash
# Current state
src/import_resolution/namespace_imports/
├── README.md ✅
├── namespace_imports.test.ts ✅
├── namespace_imports.javascript.test.ts ✅
└── namespace_imports.typescript.test.ts (pending)

# To complete
├── namespace_imports.contract.ts (NEW)
├── namespace_imports.ts (NEW - adapter base)
├── namespace_imports.javascript.ts (NEW - adapter)
├── namespace_imports.python.ts (NEW)
├── namespace_imports.python.test.ts (NEW)
├── namespace_imports.rust.ts (NEW)
└── namespace_imports.rust.test.ts (NEW)
```

### Method Chaining (New Implementation)

```typescript
// method_chaining.contract.ts
export const MethodChainingContract: FeatureContract = {
  meta: {
    name: 'method_chaining',
    category: 'call_graph',
    universalSupport: true
  },
  testCases: [
    // Simple chains: obj.a().b()
    // Complex chains: obj.a().b().c()
    // Nested chains: obj.a(other.b()).c()
    // Optional chains: obj?.a()?.b() (JS only)
    // Iterator chains: vec.iter().map().filter() (Rust)
  ]
};
```

### Basic Imports (Extract from Existing)

```typescript
// basic_imports.contract.ts
export const BasicImportsContract: FeatureContract = {
  meta: {
    name: 'basic_imports',
    category: 'import_resolution',
    universalSupport: true
  },
  testCases: [
    // Default imports: import foo from 'bar'
    // Named imports: import { foo } from 'bar'
    // Renamed imports: import { foo as bar } from 'baz'
    // Side-effect imports: import 'polyfill'
  ]
};
```

## Success Metrics for POC

### Phase 1 Goals
- [ ] 3 features fully migrated
- [ ] Test contracts validated
- [ ] All languages have implementations
- [ ] Documentation complete
- [ ] Validation scripts working

### Quality Metrics
- [ ] Zero regression in existing tests
- [ ] 100% contract compliance
- [ ] < 5 second validation time
- [ ] Clear improvement in discoverability

### Developer Experience Goals
- [ ] New feature scaffold in < 30 seconds
- [ ] Clear error messages from validation
- [ ] Intuitive folder navigation
- [ ] Reduced cognitive load

## Risk Mitigation

### Risk: Breaking existing functionality
**Mitigation**: 
- Keep old code during migration
- Run parallel tests
- Feature flag new implementations

### Risk: Performance regression
**Mitigation**:
- Benchmark before/after
- Profile adapter overhead
- Optimize hot paths

### Risk: Developer confusion
**Mitigation**:
- Clear migration guide
- Video walkthrough
- Pair programming sessions

## Timeline

### Week 1: Foundation
- Day 1-2: Complete namespace imports
- Day 3-4: Implement method chaining
- Day 5: Implement basic imports

### Week 2: Validation
- Day 1: Create validation scripts
- Day 2: Test contract compliance
- Day 3: Fix issues found
- Day 4-5: Documentation and review

### Week 3: Rollout
- Day 1-2: Team training
- Day 3-4: Migrate one more feature together
- Day 5: Plan full migration

## Next Steps

1. **Immediate**: Complete namespace imports implementation
2. **Tomorrow**: Start method chaining with contract
3. **This Week**: Have 3 features fully migrated
4. **Next Week**: Validation and tooling complete

## Notes for Team

- This is a learning exercise - expect to refine patterns
- Document all decisions and gotchas
- Share progress daily
- Ask questions early and often
- Focus on developer experience