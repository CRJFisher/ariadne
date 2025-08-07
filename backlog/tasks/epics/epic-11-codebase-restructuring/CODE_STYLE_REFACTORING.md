# Code Style Refactoring Plan

## Strategic Approach

### Principles
1. **Safety First**: No breaking changes without adapters
2. **Incremental**: Small, testable changes
3. **Automated**: Use tools where possible
4. **Validated**: Test at each step

### Phases
1. **Phase 1**: Critical fixes (Week 1)
2. **Phase 2**: High priority (Week 2)
3. **Phase 3**: Medium priority (Week 3)
4. **Phase 4**: Polish and automation (Week 4)

## Phase 1: Critical Fixes (Week 1)

### Day 1-2: File Size Violations

#### Task 1: Split edge_cases.test.ts (3 hours)
```typescript
// Current: tests/edge_cases.test.ts (31.3KB)
// Split into:
tests/edge_cases/
├── namespace_imports.test.ts
├── complex_destructuring.test.ts
├── async_patterns.test.ts
├── class_inheritance.test.ts
└── index.test.ts  // Re-exports all tests
```

**Steps:**
1. Create tests/edge_cases/ directory
2. Move test groups to separate files
3. Update imports in other files
4. Run test suite to verify

#### Task 2: Split javascript_core_features.test.ts (3 hours)
```typescript
// Split into:
tests/languages/javascript/
├── functions.test.ts
├── classes.test.ts
├── imports.test.ts
├── async.test.ts
└── core.test.ts
```

#### Task 3: Split reference_resolution.ts (5 hours)
```typescript
// Current: src/call_graph/call_analysis/reference_resolution.ts
// Split into:
src/call_graph/reference_resolution/
├── variable_resolver.ts
├── import_resolver.ts
├── type_resolver.ts
├── property_resolver.ts
└── index.ts  // Public API
```

### Day 3-4: Stateful Classes

#### Task 4: Convert ScopeGraph to Immutable (8 hours)

**Current (Stateful):**
```typescript
class ScopeGraph {
  scopes: Scope[] = [];
  
  add_scope(scope: Scope) {
    this.scopes.push(scope);  // MUTATION!
  }
}
```

**Target (Immutable):**
```typescript
// src/scope_resolution/scope_graph.ts
interface ScopeGraph {
  readonly scopes: ReadonlyArray<Scope>;
}

function add_scope(graph: ScopeGraph, scope: Scope): ScopeGraph {
  return {
    ...graph,
    scopes: [...graph.scopes, scope]
  };
}
```

**Migration Strategy:**
1. Create new immutable functions alongside class
2. Add adapter that wraps immutable in class API
3. Migrate consumers one by one
4. Remove class when all migrated

#### Task 5: Refactor Project Class (8 hours)

**Adapter Pattern:**
```typescript
// src/project/project_immutable.ts
interface ProjectState {
  readonly files: ReadonlyMap<string, FileData>;
  readonly storage: StorageInterface;
}

// Immutable operations
function add_file(state: ProjectState, path: string, content: string): ProjectState {
  return {
    ...state,
    files: new Map([...state.files, [path, parse_file(content)]])
  };
}

// src/project/project.ts (temporary adapter)
class Project {
  private state: ProjectState;
  
  add_file(path: string, content: string) {
    this.state = add_file(this.state, path, content);
  }
}
```

### Day 5: Core Mutations

#### Task 6: Remove all .push() operations (4 hours)

**Script to find all mutations:**
```bash
rg "\.push\(" --type ts | wc -l  # Count: 67 instances
```

**Automated fix with codemod:**
```javascript
// codemod-remove-push.js
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  
  return j(fileInfo.source)
    .find(j.CallExpression, {
      callee: {
        property: { name: 'push' }
      }
    })
    .replaceWith(path => {
      const array = path.node.callee.object;
      const args = path.node.arguments;
      return j.assignmentExpression(
        '=',
        array,
        j.arrayExpression([
          j.spreadElement(array),
          ...args
        ])
      );
    })
    .toSource();
};
```

## Phase 2: High Priority (Week 2)

### Day 1-2: Long Functions

#### Task 7: Split build_scope_graph (8 hours)

**Current:** 457 lines
**Target:** 5 functions, each < 50 lines

```typescript
// Before: One massive function
function build_scope_graph(ast: Node): ScopeGraph { 
  // 457 lines of code
}

// After: Composed smaller functions
function build_scope_graph(ast: Node): ScopeGraph {
  const nodes = collect_scope_nodes(ast);
  const scopes = create_scopes(nodes);
  const hierarchy = build_hierarchy(scopes);
  const bindings = resolve_bindings(hierarchy);
  return finalize_graph(bindings);
}

function collect_scope_nodes(ast: Node): ScopeNode[] {
  // ~50 lines
}

function create_scopes(nodes: ScopeNode[]): Scope[] {
  // ~50 lines
}
// etc...
```

#### Task 8: Refactor resolve_reference (6 hours)

**Strategy Pattern:**
```typescript
// src/call_graph/reference_resolution/strategies.ts
interface ResolutionStrategy {
  can_resolve(node: Node): boolean;
  resolve(node: Node, context: Context): Resolution;
}

const strategies: ResolutionStrategy[] = [
  new VariableResolutionStrategy(),
  new ImportResolutionStrategy(),
  new TypeResolutionStrategy(),
  new PropertyResolutionStrategy()
];

function resolve_reference(node: Node, context: Context): Resolution {
  const strategy = strategies.find(s => s.can_resolve(node));
  return strategy ? strategy.resolve(node, context) : null;
}
```

### Day 3-4: Naming Conventions

#### Task 9: Automated snake_case conversion (12 hours)

**ESLint configuration:**
```json
{
  "rules": {
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "function",
        "format": ["snake_case"]
      },
      {
        "selector": "variable",
        "format": ["snake_case"]
      },
      {
        "selector": "parameter",
        "format": ["snake_case"]
      }
    ]
  }
}
```

**Automated fix script:**
```bash
# Run ESLint with auto-fix
npx eslint --fix "src/**/*.ts"

# Update imports
find . -name "*.ts" -exec sed -i 's/addFile/add_file/g' {} \;
find . -name "*.ts" -exec sed -i 's/getFile/get_file/g' {} \;
# ... etc for all functions
```

**Temporary aliases for backwards compatibility:**
```typescript
// Maintain old names as aliases during migration
export {
  add_file as addFile,  // Deprecated
  get_file as getFile,  // Deprecated
  // etc...
}
```

### Day 5: Testing and Validation

#### Task 10: Comprehensive test run (4 hours)
- Run full test suite
- Check performance benchmarks
- Validate no regressions
- Update snapshots if needed

## Phase 3: Medium Priority (Week 3)

### Day 1-3: Module Reorganization

#### Task 11: Restructure directories (8 hours)

**New structure:**
```
src/
├── core/
│   ├── project/
│   ├── storage/
│   └── languages/
├── analysis/
│   ├── call_graph/
│   ├── scope/
│   └── types/
├── resolution/
│   ├── imports/
│   ├── references/
│   └── modules/
└── utils/
    ├── ast/
    └── source/
```

**Migration script:**
```bash
#!/bin/bash
# migrate-structure.sh

# Create new directories
mkdir -p src/core src/analysis src/resolution

# Move files
mv src/project src/core/
mv src/call_graph src/analysis/
mv src/scope_resolution.ts src/analysis/scope/

# Update imports
find . -name "*.ts" -exec sed -i 's|from "../project|from "../core/project|g' {} \;
```

### Day 4-5: Complexity Reduction

#### Task 12: Reduce cyclomatic complexity (16 hours)

**Use complexity analyzer:**
```bash
npx eslint --rule 'complexity: ["error", 10]' src/
```

**Refactoring patterns:**

1. **Guard Clauses:**
```typescript
// Before: Nested if statements
function process(x) {
  if (x) {
    if (x.valid) {
      if (x.ready) {
        // actual logic
      }
    }
  }
}

// After: Guard clauses
function process(x) {
  if (!x) return;
  if (!x.valid) return;
  if (!x.ready) return;
  
  // actual logic
}
```

2. **Extract Conditionals:**
```typescript
// Before: Complex condition
if (node.type === 'call' && node.args.length > 0 && !node.async) {
  // ...
}

// After: Named predicate
const is_sync_call_with_args = (node) => 
  node.type === 'call' && node.args.length > 0 && !node.async;

if (is_sync_call_with_args(node)) {
  // ...
}
```

## Phase 4: Polish and Automation (Week 4)

### Day 1-2: Documentation

#### Task 13: Add inline documentation (8 hours)

**Documentation template:**
```typescript
/**
 * Resolves a reference to its definition
 * @param node - The reference node to resolve
 * @param context - Current resolution context
 * @returns The resolved definition or null if not found
 * @example
 * const definition = resolve_reference(refNode, context);
 */
function resolve_reference(node: Node, context: Context): Definition | null {
  // implementation
}
```

### Day 3-4: Automation Setup

#### Task 14: Pre-commit hooks (4 hours)

**Husky configuration:**
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint:fix && npm run test:unit"
    }
  }
}
```

**File size check script:**
```javascript
// scripts/check-file-size.js
const fs = require('fs');
const path = require('path');

const MAX_SIZE = 32 * 1024; // 32KB

function checkFileSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_SIZE) {
    console.error(`❌ ${filePath}: ${stats.size} bytes (exceeds 32KB)`);
    process.exit(1);
  }
}

// Check all TypeScript files
glob.sync('src/**/*.ts').forEach(checkFileSize);
```

### Day 5: Final Validation

#### Task 15: Complete audit (4 hours)
- Re-run code style audit
- Verify all critical issues fixed
- Update documentation
- Create maintenance guide

## Risk Mitigation Strategies

### For Each Major Change

1. **Before:**
   - Create feature branch
   - Run full test suite
   - Benchmark performance

2. **During:**
   - Make incremental commits
   - Test after each step
   - Keep old code commented

3. **After:**
   - Run regression tests
   - Check performance
   - Update documentation

### Rollback Procedures

For each refactoring:
```bash
# Tag before changes
git tag before-refactor-X

# If rollback needed
git reset --hard before-refactor-X
```

## Success Criteria

### Phase 1 Complete When:
- [ ] All files < 32KB
- [ ] No stateful classes in core
- [ ] No direct mutations

### Phase 2 Complete When:
- [ ] All functions < 100 lines
- [ ] snake_case throughout
- [ ] Tests passing

### Phase 3 Complete When:
- [ ] New directory structure
- [ ] Complexity < 10
- [ ] Clean module boundaries

### Phase 4 Complete When:
- [ ] Automation in place
- [ ] Documentation complete
- [ ] Style guide enforced

## Maintenance Plan

### Weekly Tasks
- Run style audit
- Check file sizes
- Review new code

### Monthly Tasks
- Update style guide
- Review automation
- Team training

### Quarterly Tasks
- Full codebase audit
- Tool updates
- Process improvement