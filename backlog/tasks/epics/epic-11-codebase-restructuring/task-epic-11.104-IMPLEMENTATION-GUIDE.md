# Task Epic 11.104 Implementation Guide

**Quick Reference for Implementing Reference Metadata Extraction**

## Overview

This epic implements Phase 2 & 3 from REFERENCE_METADATA_PLAN.md: language-specific metadata extractors that enable accurate method resolution and call-chain detection.

## Task Structure (23 tasks total)

```
104 - Implement Reference Metadata Extraction (Parent)
├── 104.1 - Create metadata extractor interface (30m) ✅ FOUNDATION
├── 104.2 - Refactor reference_builder for extractors (1.5h) ✅ FOUNDATION
├── 104.3 - JavaScript/TypeScript Implementation (5h 15m)
│   ├── 104.3.1 - Implement javascript_metadata.ts (2h)
│   ├── 104.3.2 - Test javascript_metadata.ts (1.5h)
│   ├── 104.3.3 - Wire JS/TS extractors (45m)
│   ├── 104.3.4 - Fix semantic_index.javascript.test.ts (1h)
│   └── 104.3.5 - Fix semantic_index.typescript.test.ts (45m)
├── 104.4 - Python Implementation (4h)
│   ├── 104.4.1 - Implement python_metadata.ts (2h)
│   ├── 104.4.2 - Test python_metadata.ts (1h)
│   ├── 104.4.3 - Wire Python extractors (30m)
│   └── 104.4.4 - Fix semantic_index.python.test.ts (30m)
├── 104.5 - Rust Implementation (5h)
│   ├── 104.5.1 - Implement rust_metadata.ts (2.5h)
│   ├── 104.5.2 - Test rust_metadata.ts (1.5h)
│   ├── 104.5.3 - Wire Rust extractors (30m)
│   └── 104.5.4 - Fix semantic_index.rust.test.ts (30m)
└── 104.6 - Integration & Validation (2.5h)
    ├── 104.6.1 - Update reference_builder.test.ts (1h)
    ├── 104.6.2 - End-to-end validation (1h)
    └── 104.6.3 - Cleanup and documentation (30m)

Total Estimated Effort: 18.25 hours
```

## Implementation Sequence

### Phase 1: Foundation (2 hours)
**Must complete first - all other tasks depend on these**

1. **104.1** - Creates `metadata_types.ts` with `MetadataExtractors` interface
2. **104.2** - Updates `reference_builder.ts` to accept extractors parameter

After these tasks:
- ✅ Type definitions in place
- ✅ Infrastructure ready for language implementations
- ⚠️ Tests will fail (no extractors implemented yet)

### Phase 2: JavaScript/TypeScript (5.25 hours)
**Start here for proof-of-concept**

3. **104.3.1** - Implement JavaScript/TypeScript extractors
4. **104.3.2** - Test extractors in isolation
5. **104.3.3** - Wire into semantic_index.ts
6. **104.3.4** - Fix JavaScript integration tests
7. **104.3.5** - Fix TypeScript integration tests

After these tasks:
- ✅ JavaScript and TypeScript fully working with metadata
- ✅ Proof-of-concept complete
- ⚠️ Python and Rust tests still fail

### Phase 3: Python (4 hours)
**Can be done in parallel with Rust if resources available**

8. **104.4.1** - Implement Python extractors
9. **104.4.2** - Test Python extractors
10. **104.4.3** - Wire into semantic_index.ts
11. **104.4.4** - Fix Python integration tests

After these tasks:
- ✅ Python fully working with metadata
- ⚠️ Rust tests still fail

### Phase 4: Rust (5 hours)
**Can be done in parallel with Python if resources available**

12. **104.5.1** - Implement Rust extractors
13. **104.5.2** - Test Rust extractors
14. **104.5.3** - Wire into semantic_index.ts
15. **104.5.4** - Fix Rust integration tests

After these tasks:
- ✅ All 4 languages working with metadata

### Phase 5: Integration & Validation (2.5 hours)
**Final polish and verification**

16. **104.6.1** - Update reference_builder unit tests
17. **104.6.2** - Cross-language validation tests
18. **104.6.3** - Cleanup TODOs and documentation

After these tasks:
- ✅ Production ready
- ✅ Documented and validated

## Critical Path

**Sequential dependencies (must follow order):**
```
104.1 → 104.2 → 104.3.1 → 104.3.2 → 104.3.3 → (104.3.4, 104.3.5)
                                              ↓
                                     (104.4.x, 104.5.x can run parallel)
                                              ↓
                                            104.6.x
```

**Parallelizable work:**
- 104.3.4 and 104.3.5 (JS and TS test fixes)
- 104.4.x and 104.5.x (Python and Rust implementations)

## Quick Start Guide

### 1. Begin Implementation

```bash
# Start with foundation
cd /Users/chuck/workspace/ariadne

# Read task details
cat backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.104.1-*.md
```

### 2. Verify Setup

Before starting, ensure:
- ✅ All task-epic-11.103.x tasks complete (capture name validation)
- ✅ TypeScript compiles: `cd packages/core && npx tsc --noEmit`
- ✅ Tests run: `npm test`

### 3. Track Progress

Each task file has:
- **Status:** Not Started / In Progress / Completed
- **Estimated Effort:** Time estimate
- **Dependencies:** What must be done first
- **Success Criteria:** How to know it's done

Update `Status` field as you work.

### 4. Testing Strategy

```bash
# Test individual extractor
npx vitest src/index_single_file/query_code_tree/language_configs/javascript_metadata.test.ts

# Test integration for a language
npx vitest src/index_single_file/semantic_index.javascript.test.ts

# Test everything
npm test
```

## Key Files Modified

| File | Tasks | Purpose |
|------|-------|---------|
| `metadata_types.ts` | 104.1 | Interface definition |
| `reference_builder.ts` | 104.2 | Accept extractors param |
| `javascript_metadata.ts` | 104.3.1 | JS/TS extractors |
| `python_metadata.ts` | 104.4.1 | Python extractors |
| `rust_metadata.ts` | 104.5.1 | Rust extractors |
| `semantic_index.ts` | 104.3.3, 104.4.3, 104.5.3 | Wire extractors |
| `reference_builder.test.ts` | 104.6.1 | Unit tests |

## Success Metrics

### Code Metrics
- ✅ TypeScript compiles with 0 errors
- ✅ All tests pass (>95% coverage maintained)
- ✅ No ESLint errors

### Functional Metrics
- ✅ 80%+ method calls have `receiver_location`
- ✅ 90%+ type references have `type_info`
- ✅ 75%+ property accesses have `property_chain`

### Quality Metrics
- ✅ All TODO comments removed
- ✅ Documentation updated
- ✅ No performance regression (benchmark if needed)

## Troubleshooting

### Common Issues

**Issue:** TypeScript errors about missing extractors parameter
- **Fix:** Update function signatures to accept `MetadataExtractors`
- **Where:** Any function calling `process_references()`

**Issue:** Tests fail with "Cannot read property of undefined"
- **Fix:** Extractors returning `undefined` is valid - tests should handle it
- **Where:** Update test assertions to check `?.` optional chaining

**Issue:** AST traversal returns wrong nodes
- **Fix:** Use tree-sitter CLI to inspect AST structure
- **Command:** `npx tree-sitter parse --scope source.js "your code here"`

**Issue:** Integration tests fail after wiring extractors
- **Fix:** Update test assertions - metadata may change reference structure
- **Where:** semantic_index.*.test.ts files

### Getting Help

- **AST Structure:** Use tree-sitter playground or CLI
- **Examples:** Look at javascript_metadata.ts for patterns
- **Tests:** Copy test structure from javascript_metadata.test.ts

## Post-Implementation

### Follow-Up Work

After completing this epic:

1. **Use metadata in method_resolution.ts**
   - Consume `receiver_location` for method resolution
   - Use `type_info` to narrow down candidates
   - Leverage `property_chain` for chained calls

2. **Performance Optimization**
   - Profile metadata extraction overhead
   - Cache expensive operations if needed
   - Optimize AST traversal

3. **Enhanced Features**
   - Type inference for untyped code
   - Flow-sensitive type tracking
   - Cross-file type resolution

### Maintenance

- Update extractors when tree-sitter grammars change
- Add new extractor methods if new metadata needs arise
- Keep tests updated with new language features

## Related Documentation

- **REFERENCE_METADATA_PLAN.md** - Original plan and architecture
- **packages/core/README.md** - Core package overview
- **Tree-sitter docs** - https://tree-sitter.github.io/tree-sitter/

## Task Checklist

Use this to track overall progress:

- [ ] 104.1 - Create metadata extractor interface
- [ ] 104.2 - Refactor reference_builder
- [ ] 104.3.1 - Implement javascript_metadata.ts
- [ ] 104.3.2 - Test javascript_metadata.ts
- [ ] 104.3.3 - Wire JS/TS extractors
- [ ] 104.3.4 - Fix JavaScript tests
- [ ] 104.3.5 - Fix TypeScript tests
- [ ] 104.4.1 - Implement python_metadata.ts
- [ ] 104.4.2 - Test python_metadata.ts
- [ ] 104.4.3 - Wire Python extractors
- [ ] 104.4.4 - Fix Python tests
- [ ] 104.5.1 - Implement rust_metadata.ts
- [ ] 104.5.2 - Test rust_metadata.ts
- [ ] 104.5.3 - Wire Rust extractors
- [ ] 104.5.4 - Fix Rust tests
- [ ] 104.6.1 - Update reference_builder tests
- [ ] 104.6.2 - End-to-end validation
- [ ] 104.6.3 - Cleanup and documentation

**Progress: 0/18 tasks complete (0%)**

---

**Last Updated:** 2025-09-30
**Status:** Ready to start
**Next Task:** 104.1 - Create metadata extractor interface
