# Documentation Migration Mapping

## Overview

Mapping of all existing documentation to the new feature-based structure, identifying what needs updating, deprecation, or creation.

## Current Documentation Status

### Existing Documentation Files

| File | Location | Status | Content |
|------|----------|--------|---------|
| README.md | /README.md | OUTDATED | Old API examples, wrong structure |
| Architecture.md | /docs/architecture.md | OUTDATED | References old file structure |
| API.md | /docs/api.md | INCOMPLETE | Missing many functions |
| Contributing.md | /CONTRIBUTING.md | OUTDATED | Old development setup |
| Language Support | /docs/languages/ | PARTIAL | Some languages documented |
| Examples | /examples/ | BROKEN | Use old API |

### Documentation Embedded in Code

| Location | Type | Status |
|----------|------|--------|
| JSDoc comments | Inline | INCONSISTENT - Some functions documented |
| Type definitions | .d.ts files | INCOMPLETE - Missing many types |
| Test descriptions | .test.ts | GOOD - Most tests have descriptions |

## Documentation Migration Plan

### 1. README.md Updates

#### Current Problems
- Examples use old Project class API
- Installation instructions incomplete
- No mention of language parity requirements
- Architecture diagram outdated

#### Updates Required

```markdown
# OLD (current README.md)
const project = new Project();
project.addFile('src/index.js', content);
const callGraph = project.getCallGraph();

# NEW (updated for functional API)
import { createProject, addFile, getCallGraph } from 'ariadne';

const project = createProject();
const updatedProject = addFile(project, 'src/index.js', content);
const callGraph = getCallGraph(updatedProject);
```

#### New Sections to Add
- Feature-based architecture overview
- Language parity explanation
- Test contract system
- Migration guide from v1

### 2. Architecture Documentation

#### Current: /docs/architecture.md

```
Current Structure (OUTDATED):
src/
├── project/          # Main API
├── call_graph/       # Call analysis
├── utils/            # Utilities
└── languages/        # Language support
```

#### New: /docs/architecture/overview.md

```
Feature-Based Structure:
src/
├── analysis/         # Core analysis features
│   ├── call_graph/   # Call detection & resolution
│   ├── scope/        # Scope resolution
│   ├── imports/      # Import/export detection
│   └── types/        # Type tracking
├── project/          # Project management
│   ├── state/        # Immutable state
│   ├── operations/   # Pure operations
│   └── api/          # Public API
└── languages/        # Language configurations
```

#### Additional Architecture Docs

| New Document | Location | Purpose |
|--------------|----------|---------|
| Feature Organization | /docs/architecture/features.md | Explain feature-based structure |
| Language Specialization | /docs/architecture/languages.md | Universal vs language-specific |
| Test Contracts | /docs/architecture/testing.md | Contract-based testing |
| Immutable Architecture | /docs/architecture/immutable.md | Functional patterns |

### 3. API Documentation

#### Current API Docs (Incomplete)

| Class/Function | Documented | Location |
|----------------|------------|----------|
| Project class | PARTIAL | /docs/api.md |
| Call graph functions | NO | Missing |
| Scope resolution | NO | Missing |
| Type tracking | NO | Missing |

#### New API Documentation Structure

```
docs/api/
├── project/
│   ├── creating_projects.md
│   ├── file_operations.md
│   ├── analysis_operations.md
│   └── query_operations.md
├── call_graph/
│   ├── detection.md
│   ├── resolution.md
│   └── building.md
├── scope/
│   ├── building.md
│   └── resolution.md
├── imports/
│   ├── detection.md
│   └── resolution.md
└── types/
    ├── tracking.md
    └── inference.md
```

#### API Documentation Template

```markdown
# [Feature Name] API

## Overview
Brief description of the feature and its purpose.

## Universal Interface
```typescript
interface FeatureName {
  // Common methods all languages must implement
}
```

## Language Implementations

### JavaScript/TypeScript
Specific behavior for JavaScript/TypeScript.

### Python
Specific behavior for Python.

### Rust
Specific behavior for Rust.

## Examples
```typescript
// Example usage
```

## Test Contract
Link to test contract that validates this feature.
```

### 4. Feature Documentation

#### New Feature Docs to Create

| Feature | Location | Content |
|---------|----------|---------|
| Call Detection | /docs/features/call_detection.md | How calls are detected |
| Method Resolution | /docs/features/method_resolution.md | How methods are resolved |
| Scope Resolution | /docs/features/scope_resolution.md | Scope tree building |
| Import Detection | /docs/features/import_detection.md | Import/export analysis |
| Type Tracking | /docs/features/type_tracking.md | Variable type tracking |
| Reference Resolution | /docs/features/reference_resolution.md | Reference resolution |

#### Feature Doc Template

```markdown
# [Feature Name]

## What It Does
High-level description of the feature.

## How It Works
Technical explanation of the implementation.

## Universal Behavior
Behavior that's consistent across all languages.

## Language-Specific Behavior

### JavaScript/TypeScript
- Special handling for prototypes
- this binding
- etc.

### Python
- Special handling for self
- MRO
- etc.

### Rust
- Special handling for traits
- impl blocks
- etc.

## Configuration
Any configuration options.

## Limitations
Known limitations or unsupported cases.

## Examples
Code examples showing the feature in action.
```

### 5. Language Documentation

#### Current Language Docs

| Language | Current Location | Status |
|----------|-----------------|--------|
| JavaScript | /docs/languages/javascript.md | OUTDATED |
| TypeScript | /docs/languages/typescript.md | OUTDATED |
| Python | /docs/languages/python.md | PARTIAL |
| Rust | /docs/languages/rust.md | PARTIAL |

#### New Language Documentation

```
docs/languages/
├── javascript/
│   ├── overview.md
│   ├── supported_features.md
│   ├── call_patterns.md
│   ├── scope_rules.md
│   └── limitations.md
├── typescript/
│   ├── overview.md
│   ├── type_support.md
│   ├── decorators.md
│   └── namespaces.md
├── python/
│   ├── overview.md
│   ├── class_analysis.md
│   ├── import_system.md
│   └── type_hints.md
└── rust/
    ├── overview.md
    ├── trait_resolution.md
    ├── lifetime_analysis.md
    └── macro_support.md
```

### 6. Migration Documentation

#### New Migration Guide

**Location**: /docs/migration/v1_to_v2.md

```markdown
# Migrating from v1 to v2

## Breaking Changes

### Project Class → Functional API
```typescript
// v1 (Stateful)
const project = new Project();
project.addFile(path, content);

// v2 (Functional)
const project = createProject();
const newProject = addFile(project, path, content);
```

### File Organization
- Call graph functions moved to analysis/call_graph/
- Scope functions moved to analysis/scope/
- Import functions moved to analysis/imports/

### Import Changes
```typescript
// v1
import { Project } from 'ariadne';

// v2
import { 
  createProject,
  addFile,
  getCallGraph 
} from 'ariadne';
```

## Feature Mapping

| v1 Feature | v2 Location |
|------------|-------------|
| project.getCallGraph() | getCallGraph(project) |
| project.addFile() | addFile(project, ...) |
| ... | ... |
```

### 7. JSDoc Comments Update

#### Current JSDoc Issues
- Inconsistent format
- Missing parameter descriptions
- No return type documentation
- No examples

#### New JSDoc Standard

```typescript
/**
 * Detects function calls in the given AST node.
 * 
 * @description
 * Analyzes an AST node to identify function call expressions,
 * extracting information about the callee and arguments.
 * 
 * @param node - The AST node to analyze
 * @param context - Language-specific context for detection
 * @returns Call information if a call is detected, null otherwise
 * 
 * @example
 * ```typescript
 * const callInfo = detectFunctionCall(node, context);
 * if (callInfo) {
 *   console.log(`Found call to ${callInfo.callee}`);
 * }
 * ```
 * 
 * @see {@link detectMethodCall} for method call detection
 * @see {@link CallDetectionContract} for test contract
 * 
 * @since 2.0.0
 */
export function detectFunctionCall(
  node: Node,
  context: DetectionContext
): CallInfo | null {
  // Implementation
}
```

### 8. Example Updates

#### Current Examples (BROKEN)

| Example | Location | Issue |
|---------|----------|-------|
| Basic usage | /examples/basic.js | Uses old API |
| Cross-file | /examples/cross_file.js | Wrong imports |
| TypeScript | /examples/typescript.ts | Outdated types |

#### New Examples Structure

```
examples/
├── basic/
│   ├── javascript.js
│   ├── typescript.ts
│   ├── python.py
│   └── rust.rs
├── cross_file/
│   ├── project/
│   └── README.md
├── features/
│   ├── call_detection.js
│   ├── scope_resolution.js
│   └── type_tracking.js
└── migration/
    ├── from_v1.js
    └── README.md
```

### 9. Documentation to Deprecate

| Document | Reason | Action |
|----------|--------|--------|
| /docs/api.md | Incomplete, wrong structure | Replace with feature-based API docs |
| /docs/development.md | Old setup instructions | Update for new structure |
| /docs/internals.md | References old architecture | Rewrite for new architecture |

### 10. Documentation Generation

#### Automated Documentation

| Tool | Purpose | Configuration |
|------|---------|---------------|
| TypeDoc | Generate API reference | typedoc.json |
| JSDoc | Extract inline docs | jsdoc.json |
| Docusaurus | Documentation site | docusaurus.config.js |

#### Documentation CI/CD

```yaml
# .github/workflows/docs.yml
name: Documentation
on:
  push:
    branches: [main]
jobs:
  generate:
    steps:
      - Generate API docs from code
      - Validate all examples compile
      - Check for broken links
      - Deploy to documentation site
```

## Documentation Priorities

### Phase 1: Critical Updates (Week 1)
1. Update README with new API
2. Create migration guide
3. Document breaking changes

### Phase 2: API Documentation (Week 2)
1. Document all public APIs
2. Add JSDoc to all exported functions
3. Generate API reference

### Phase 3: Feature Documentation (Week 3)
1. Document each feature
2. Add examples for each feature
3. Document language differences

### Phase 4: Polish (Week 4)
1. Review all documentation
2. Add diagrams and visualizations
3. Set up documentation site

## Success Metrics

- [ ] All public APIs documented
- [ ] All examples working
- [ ] Migration guide complete
- [ ] No broken links
- [ ] JSDoc coverage > 90%
- [ ] Documentation site deployed