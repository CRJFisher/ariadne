# Task 116: Integration Testing Overhaul - Complete Task Index

## Overview

Complete integration testing overhaul using JSON fixtures across all 4 supported languages (TypeScript, Python, Rust, JavaScript).

**Total Tasks:** 1 main + 8 phases + 30 sub-tasks = **39 tasks**
**Total Estimated Effort:** ~73 hours

## Navigation

### 📋 Main Documents

- **[README-TASK-116.md](./README-TASK-116.md)** - Quick overview and navigation
- **[task-epic-11.116-SUMMARY.md](./task-epic-11.116-SUMMARY.md)** - Executive summary with strategy
- **[task-epic-11.116.md](./task-epic-11.116-Integration-Testing-Overhaul-with-JSON-Fixtures.md)** - Main task description

## Task Breakdown

### Phase 1: Foundation (~17 hours)

#### 116.1: Design (5-6h)
- **[116.1 - Design Fixture Folder Structure and JSON Schemas](./task-epic-11.116.1-Design-Fixture-Folder-Structure-and-JSON-Schemas.md)**
  - 116.1.1: Design folder structure
  - 116.1.2: Design SemanticIndex JSON schema
  - 116.1.3: Design ResolvedSymbols JSON schema
  - 116.1.4: Design CallGraph JSON schema
  - 116.1.5: Create TypeScript types

#### 116.2: Tooling (10h)
- **[116.2 - Implement Fixture Generation Tooling](./task-epic-11.116.2-Implement-Fixture-Generation-Tooling.md)**
  - 116.2.1: semantic_index fixture generator
  - 116.2.2: symbol_resolution fixture generator
  - 116.2.3: call_graph fixture generator
  - 116.2.4: Unified CLI tool
  - 116.2.5: Validation utilities

### Phase 2: Fixtures (~15 hours)

#### 116.3: Code Fixtures (9h) - **6 sub-tasks**
- **[116.3.1 - TypeScript Code Fixtures](./task-epic-11.116.3.1-TypeScript-Code-Fixtures.md)** (2h)
- **[116.3.2 - Python Code Fixtures](./task-epic-11.116.3.2-Python-Code-Fixtures.md)** (1.5h)
- **[116.3.3 - Rust Code Fixtures](./task-epic-11.116.3.3-Rust-Code-Fixtures.md)** (1.5h)
- **[116.3.4 - JavaScript Code Fixtures](./task-epic-11.116.3.4-JavaScript-Code-Fixtures.md)** (1h)
- **[116.3.5 - Feature Coverage Matrix](./task-epic-11.116.3.5-Feature-Coverage-Matrix.md)** (1h)
- **[116.3.6 - Fill Coverage Gaps](./task-epic-11.116.3.6-Fill-Coverage-Gaps.md)** (2h)

#### 116.4: Generate Initial JSON (5-6h)
- **[116.4 - Generate Initial JSON Fixtures](./task-epic-11.116.4-Generate-Initial-JSON-Fixtures.md)**
  - 116.4.1: Generate semantic_index JSON
  - 116.4.2: Generate symbol_resolution JSON
  - 116.4.3: Generate call_graph JSON
  - 116.4.4: Review and validate

### Phase 3: Test Migration (~41 hours)

#### 116.5: semantic_index Tests (12h) - **5 sub-tasks**
- **[116.5.0 - Test Helpers for Semantic Index](./task-epic-11.116.5.0-Test-Helpers-for-Semantic-Index.md)** (2h)
- **[116.5.1 - TypeScript Semantic Index Tests](./task-epic-11.116.5.1-TypeScript-Semantic-Index-Tests.md)** (2h)
- **[116.5.2 - Python Semantic Index Tests](./task-epic-11.116.5.2-Python-Semantic-Index-Tests.md)** (1.5h)
- **[116.5.3 - Rust Semantic Index Tests](./task-epic-11.116.5.3-Rust-Semantic-Index-Tests.md)** (1.5h)
- **[116.5.4 - JavaScript Semantic Index Tests](./task-epic-11.116.5.4-JavaScript-Semantic-Index-Tests.md)** (1h)

#### 116.6: symbol_resolution Tests (15h) - **5 sub-tasks**
- **[116.6.0 - Test Helpers for Symbol Resolution](./task-epic-11.116.6.0-Test-Helpers-for-Symbol-Resolution.md)** (2h)
- **[116.6.1 - TypeScript Symbol Resolution Tests](./task-epic-11.116.6.1-TypeScript-Symbol-Resolution-Tests.md)** (2.5h)
- **[116.6.2 - Python Symbol Resolution Tests](./task-epic-11.116.6.2-Python-Symbol-Resolution-Tests.md)** (2h)
- **[116.6.3 - Rust Symbol Resolution Tests](./task-epic-11.116.6.3-Rust-Symbol-Resolution-Tests.md)** (2h)
- **[116.6.4 - JavaScript Symbol Resolution Tests](./task-epic-11.116.6.4-JavaScript-Symbol-Resolution-Tests.md)** (1.5h)

#### 116.7: call_graph Tests (NEW - 14h) - **5 sub-tasks**
- **[116.7.0 - Test Helpers for Call Graph](./task-epic-11.116.7.0-Test-Helpers-for-Call-Graph.md)** (2h)
- **[116.7.1 - TypeScript Call Graph Tests](./task-epic-11.116.7.1-TypeScript-Call-Graph-Tests.md)** (2.5h) ⭐ NEW
- **[116.7.2 - Python Call Graph Tests](./task-epic-11.116.7.2-Python-Call-Graph-Tests.md)** (2h) ⭐ NEW
- **[116.7.3 - Rust Call Graph Tests](./task-epic-11.116.7.3-Rust-Call-Graph-Tests.md)** (2h) ⭐ NEW
- **[116.7.4 - JavaScript Call Graph Tests](./task-epic-11.116.7.4-JavaScript-Call-Graph-Tests.md)** (1.5h) ⭐ NEW

### Phase 4: Documentation (9h)

#### 116.8: Documentation and Tooling Finalization
- **[116.8 - Documentation and Tooling Finalization](./task-epic-11.116.8-Documentation-and-Tooling-Finalization.md)**
  - 116.8.1: Document fixture format
  - 116.8.2: Create update workflow docs
  - 116.8.3: Add CI validation
  - 116.8.4: Create troubleshooting guide

## Dependency Graph

```
116.1 (Design)
  ├─→ 116.2 (Tooling)
  └─→ 116.3.1-116.3.4 (Language Fixtures) ─→ 116.3.5 (Coverage) ─→ 116.3.6 (Fill Gaps)

116.2 + 116.3 ─→ 116.4 (Generate JSON)

116.4 ─→ 116.5.0 (Helpers) ─→ 116.5.1-116.5.4 (semantic_index tests)

116.5 ─→ 116.6.0 (Helpers) ─→ 116.6.1-116.6.4 (symbol_resolution tests)

116.6 ─→ 116.7.0 (Helpers) ─→ 116.7.1-116.7.4 (call_graph tests) ⭐ NEW

116.7 ─→ 116.8 (Documentation)
```

## Parallelization Opportunities

### Can Run in Parallel:

**Phase 2:**
- 116.3.1, 116.3.2, 116.3.3, 116.3.4 (all language fixture reorganizations)

**Phase 3:**
- 116.5.1, 116.5.2, 116.5.3, 116.5.4 (after 116.5.0 complete)
- 116.6.1, 116.6.2, 116.6.3, 116.6.4 (after 116.6.0 complete)
- 116.7.1, 116.7.2, 116.7.3, 116.7.4 (after 116.7.0 complete)

**Team Assignment Suggestion:**
- **Person A:** TypeScript tasks (116.3.1, 116.5.1, 116.6.1, 116.7.1)
- **Person B:** Python tasks (116.3.2, 116.5.2, 116.6.2, 116.7.2)
- **Person C:** Rust & JavaScript tasks (116.3.3, 116.3.4, 116.5.3, 116.5.4, 116.6.3, 116.6.4, 116.7.3, 116.7.4)
- **Person D:** Infrastructure (116.1, 116.2, 116.4, helpers, 116.8)

## Summary by Language

### TypeScript (11 tasks, ~15h)
- 116.3.1: Code fixtures (2h)
- 116.5.1: semantic_index tests (2h)
- 116.6.1: symbol_resolution tests (2.5h)
- 116.7.1: call_graph tests (2.5h) ⭐ NEW
- Plus shared tasks

### Python (10 tasks, ~12h)
- 116.3.2: Code fixtures (1.5h)
- 116.5.2: semantic_index tests (1.5h)
- 116.6.2: symbol_resolution tests (2h)
- 116.7.2: call_graph tests (2h) ⭐ NEW
- Plus shared tasks

### Rust (10 tasks, ~12h)
- 116.3.3: Code fixtures (1.5h)
- 116.5.3: semantic_index tests (1.5h)
- 116.6.3: symbol_resolution tests (2h)
- 116.7.3: call_graph tests (2h) ⭐ NEW
- Plus shared tasks

### JavaScript (10 tasks, ~9.5h)
- 116.3.4: Code fixtures (1h)
- 116.5.4: semantic_index tests (1h)
- 116.6.4: symbol_resolution tests (1.5h)
- 116.7.4: call_graph tests (1.5h) ⭐ NEW
- Plus shared tasks

### Infrastructure (10 tasks, ~24h)
- 116.1: Design (5-6h)
- 116.2: Tooling (10h)
- 116.3.5-116.3.6: Coverage (3h)
- 116.4: Generate JSON (5-6h)
- 116.5.0, 116.6.0, 116.7.0: Test helpers (6h)
- 116.8: Documentation (9h)

## Progress Tracking

Use this checklist to track completion:

### Phase 1: Foundation
- [ ] 116.1 - Design ✓
- [ ] 116.2 - Tooling ✓

### Phase 2: Fixtures
- [ ] 116.3.1 - TypeScript fixtures ✓
- [ ] 116.3.2 - Python fixtures ✓
- [ ] 116.3.3 - Rust fixtures ✓
- [ ] 116.3.4 - JavaScript fixtures ✓
- [ ] 116.3.5 - Coverage matrix ✓
- [ ] 116.3.6 - Fill gaps ✓
- [ ] 116.4 - Generate JSON ✓

### Phase 3: Tests
- [ ] 116.5.0 - semantic_index helpers ✓
- [ ] 116.5.1 - TypeScript semantic_index ✓
- [ ] 116.5.2 - Python semantic_index ✓
- [ ] 116.5.3 - Rust semantic_index ✓
- [ ] 116.5.4 - JavaScript semantic_index ✓
- [ ] 116.6.0 - symbol_resolution helpers ✓
- [ ] 116.6.1 - TypeScript symbol_resolution ✓
- [ ] 116.6.2 - Python symbol_resolution ✓
- [ ] 116.6.3 - Rust symbol_resolution ✓
- [ ] 116.6.4 - JavaScript symbol_resolution ✓
- [ ] 116.7.0 - call_graph helpers ✓
- [ ] 116.7.1 - TypeScript call_graph ✓ ⭐ NEW
- [ ] 116.7.2 - Python call_graph ✓ ⭐ NEW
- [ ] 116.7.3 - Rust call_graph ✓ ⭐ NEW
- [ ] 116.7.4 - JavaScript call_graph ✓ ⭐ NEW

### Phase 4: Documentation
- [ ] 116.8 - Documentation ✓

## Quick Start

1. **Start here:** [task-epic-11.116-SUMMARY.md](./task-epic-11.116-SUMMARY.md)
2. **Begin with:** [116.1 - Design](./task-epic-11.116.1-Design-Fixture-Folder-Structure-and-JSON-Schemas.md)
3. **Track progress:** Use checklist above
4. **Parallelize:** Assign language-specific tasks to team members

## Key Benefits

✅ **Single source of truth** - One code fixture tests all three stages
✅ **Automatic coverage** - Symbol resolution tests cover all semantic_index features
✅ **Easy maintenance** - Add fixture → regenerate JSON → tests update
✅ **Fills major gap** - Creates missing call_graph integration tests
✅ **Verifiable pipeline** - Each stage validates previous stage's output

---

**Status:** Planning Complete ✅
**Implementation:** Ready to start with 116.1
**Timeline:** 2-3 weeks (dedicated) or 4-6 weeks (incremental)
