# Python Import Resolver - Scope Analysis

**Task:** task-epic-11.112.7.2 - Update Python Import Resolver
**Date:** 2025-10-06
**Result:** ✅ NO CHANGES NEEDED

---

## Executive Summary

The Python import resolver is **completely independent** of the scope system. Body-based scope changes do not affect import resolution because:

1. Import path resolution operates at the **filesystem level** only
2. Symbol resolution searches by **name**, not scope_id
3. Python nested classes **cannot be directly imported** by syntax

---

## File Analysis

### 1. `import_resolver.python.ts` - Filesystem Path Resolution

**Purpose:** Translates Python import syntax to absolute file paths

**Key Functions:**
- `resolve_module_path_python(import_path, importing_file) → FilePath`
- `resolve_relative_python()` - Handles `.module`, `..module`
- `resolve_absolute_python()` - Handles `package.module`
- `find_python_project_root()` - Detects project root via `__init__.py`

**Scope Dependencies:** NONE

**Evidence:**
```bash
$ grep -i "scope\|class" import_resolver.python.ts
# No matches
```

**Operations:**
- String parsing of dotted paths
- Directory traversal with `path.dirname()`
- File existence checks with `fs.existsSync()`
- Returns file paths only

**Conclusion:** Pure filesystem layer with zero scope awareness.

---

### 2. `import_resolver.ts` - Symbol Resolution

**Purpose:** Resolves imported symbols to their definitions

**Key Functions:**
- `extract_import_specs()` - Extracts imports from a scope
- `find_exported_class()` - Finds exported classes by name
- `resolve_export_chain()` - Follows re-export chains

**Scope Usage Analysis:**

#### `extract_import_specs()` (Line 38-64)
```typescript
for (const [import_id, import_def] of index.imported_symbols) {
  if (import_def.scope_id === scope_id) {  // ← Filters by scope
    // Process import
  }
}
```

**Impact:** Filters which imports belong to a scope. Since Python import statements are **always at module scope**, this is unaffected by class scope changes.

#### `find_exported_class()` (Line 204-214)
```typescript
function find_exported_class(name: SymbolName, index: SemanticIndex) {
  for (const [symbol_id, class_def] of index.classes) {
    if (class_def.name === name && is_exported(class_def)) {
      return class_def;  // ← Matches by NAME only
    }
  }
  return null;
}
```

**Impact:** Searches by name regardless of scope_id. Works correctly with any scope structure.

#### `is_exported()` (Line 285-292)
```typescript
function is_exported(def) {
  return (
    def.availability?.scope === "file-export" ||  // ← Checks availability.scope
    def.availability?.scope === "public"          //   NOT scope_id
  );
}
```

**Impact:** Export status is independent of scope_id. Unaffected by scope changes.

**Conclusion:** Symbol resolution is **name-based**, not scope-based.

---

## Nested Class Handling

### Python Nested Class Syntax

**Valid:**
```python
# module.py
class Outer:
    class Inner:
        pass

# other.py
from module import Outer     # ✓ Import outer class
inner_instance = Outer.Inner()  # ✓ Access via attribute
```

**Invalid:**
```python
# other.py
from module import Outer.Inner  # ❌ SyntaxError
from module import Inner        # ❌ NameError (not in module scope)
```

### Scope Structure (Body-Based)

**Before (Full-Node Scopes):**
```
module.py scope tree:
  module_scope (id: "module.py:0:0")
    ├─ Outer (class)
    │   ├─ scope_id: "module.py:0:0" (module scope)
    │   └─ Inner (nested class)
    │       └─ scope_id: "module.py:class:Outer" (Outer's scope)
```

**After (Body-Based Scopes):**
```
module.py scope tree:
  module_scope (id: "module.py:0:0")
    ├─ Outer (class definition)
    │   └─ scope_id: "module.py:0:0" (module scope) ✓
    └─ Outer_body_scope (id: "module.py:class:Outer:body")
        └─ Inner (nested class)
            └─ scope_id: "module.py:class:Outer:body" ✓
```

### Import Resolution Flow

**Step 1:** Parse import statement
```python
from module import Outer
```
- Import path: `"module"`
- Import name: `"Outer"`

**Step 2:** Resolve module path (filesystem)
```typescript
resolve_module_path_python("module", "other.py")
→ "/project/module.py"
```
- **Uses:** Filesystem only
- **Affected by scope changes:** NO

**Step 3:** Find exported symbol (name lookup)
```typescript
find_exported_class("Outer", module_index)
→ Searches: class_def.name === "Outer"
→ Finds: Outer class definition
```
- **Uses:** Symbol name only
- **Checks:** `class_def.name === "Outer"` ✓
- **Ignores:** `class_def.scope_id` (irrelevant)
- **Affected by scope changes:** NO

**Step 4:** Verify export status
```typescript
is_exported(outer_class_def)
→ Checks: availability.scope === "file-export"
→ Result: true (classes are exported)
```
- **Uses:** `availability.scope` field
- **Affected by scope changes:** NO

### Why Nested Classes Don't Matter

1. **Python syntax prevents direct import**
   - Cannot write `from module import Inner`
   - Must import `Outer` and access `Outer.Inner`

2. **Only module-level symbols are importable**
   - Import resolver only finds module-level classes
   - `Outer` is at module level (scope_id = module scope) ✓
   - `Inner` is nested (scope_id = Outer's body scope)
   - Import resolver never searches for `Inner`

3. **Name-based lookup is scope-agnostic**
   - Searches all classes by name
   - Doesn't filter by scope_id
   - Works regardless of internal scope structure

---

## Test Coverage

Existing test suite (`import_resolver.python.test.ts`):
- ✅ 90+ tests for path resolution
- ✅ Relative imports (`.`, `..`, `...`)
- ✅ Absolute imports (`package.module`)
- ✅ Package detection (`__init__.py`)
- ✅ Project root finding
- ❌ No nested class import tests (not needed - Python doesn't support it)

**Next Task:** task-epic-11.112.7.3 will verify tests pass with new scope structure

---

## Verification Commands

### 1. Confirm no scope references in Python resolver
```bash
grep -i "scope" packages/core/src/resolve_references/import_resolution/import_resolver.python.ts
# Expected: No matches
```

### 2. Confirm name-based class lookup
```bash
grep -A 5 "find_exported_class" packages/core/src/resolve_references/import_resolution/import_resolver.ts
# Expected: Matches by name only, no scope_id checks
```

### 3. Run Python import resolver tests
```bash
npm test -- import_resolver.python.test.ts
# Expected: All tests pass (filesystem-based, scope-independent)
```

---

## Conclusion

### Changes Required: NONE ✅

**Rationale:**

1. **Filesystem layer** (`import_resolver.python.ts`)
   - Zero scope awareness
   - Pure path manipulation
   - Unaffected by any scope changes

2. **Symbol layer** (`import_resolver.ts`)
   - Name-based lookups
   - Export status checks
   - Scope_id only used to filter import statements (always module-level in Python)

3. **Nested classes**
   - Cannot be directly imported in Python
   - Only outer classes are importable
   - Outer classes remain at module scope (correct with body-based scopes)

4. **Test compatibility**
   - All tests operate at filesystem level
   - No scope assumptions in test suite
   - Ready to run with new scope structure

### Next Steps

1. ✅ **task-epic-11.112.7.2** - COMPLETE (this analysis)
2. 🔜 **task-epic-11.112.7.3** - Verify Python import resolver tests pass
3. 🔜 **task-epic-11.112.7** - Complete Python .scm updates

---

## References

**Files Analyzed:**
- `packages/core/src/resolve_references/import_resolution/import_resolver.python.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts`

**Related Tasks:**
- task-epic-11.112 - Scope System Consolidation and Fixes
- task-epic-11.112.7 - Update Python .scm Body-Based Scopes
- task-epic-11.112.7.1 - Update Python .scm
- task-epic-11.112.7.2 - Update Python Import Resolver (this task)
- task-epic-11.112.7.3 - Update Python Import Resolver Tests

**Python Language Reference:**
- [PEP 227 - Statically Nested Scopes](https://www.python.org/dev/peps/pep-0227/)
- [Python Import System](https://docs.python.org/3/reference/import.html)
