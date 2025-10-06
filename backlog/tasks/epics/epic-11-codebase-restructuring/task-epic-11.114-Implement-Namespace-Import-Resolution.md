# Task Epic 11.114: Implement Full Namespace Import Resolution

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1-2 days
**Parent:** epic-11
**Dependencies:**
- task-epic-11.109 (Scope-Aware Symbol Resolution - provides infrastructure)
- task-epic-11.109.3 (Import Resolution - has partial namespace support)

## Objective

Complete namespace import resolution by implementing secondary member lookups for expressions like `utils.helper()` where `utils` is a namespace import (`import * as utils from './utils'`).

## Problem Statement

### Current Limitation

From task-epic-11.109.3 (Import Resolution):

**Current behavior:**
```typescript
import * as utils from './utils';

// This resolves:
console.log(utils);  // Resolves to the import

// This does NOT resolve:
utils.helper();  // Cannot resolve 'helper' on namespace
```

**Reason:** Namespace imports create a single symbol for the namespace itself, but accessing members requires a secondary lookup to find exported symbols from the source module.

### What We Need

**Target behavior:**
```typescript
// utils.ts
export function helper() {}
export function process() {}

// main.ts
import * as utils from './utils';

utils.helper();   // Should resolve to utils.ts::helper
utils.process();  // Should resolve to utils.ts::process
```

## Architecture

### Two-Phase Resolution

#### Phase 1: Namespace Symbol (EXISTING)
```typescript
// Resolver index already creates:
const namespace_resolver = () => {
  return create_symbol_id('utils', import_location);
};
```

#### Phase 2: Member Lookup (NEW)
```typescript
// When we see: utils.helper()
// 1. Resolve 'utils' → namespace symbol
// 2. Look up 'helper' in namespace's source module
// 3. Return the actual symbol from source
```

## Implementation Plan

### Phase 1: Namespace Metadata Tracking (4-6 hours)

**Track which modules each namespace import represents**

#### File: `packages/core/src/resolve_references/import_resolution/import_resolver.ts`

1. **Add namespace tracking structure:**
   ```typescript
   interface ImportResolutionResult {
     // Existing
     resolvers: Map<ScopeId, Map<SymbolName, SymbolResolver>>;

     // NEW: Namespace metadata
     namespace_sources: Map<SymbolId, FilePath>;
     // Maps namespace symbol_id → source file path
   }
   ```

2. **Track namespace imports during resolution:**
   ```typescript
   function resolve_imports(
     indices: ReadonlyMap<FilePath, SemanticIndex>
   ): ImportResolutionResult {
     const namespace_sources = new Map<SymbolId, FilePath>();

     for (const [file_path, index] of indices) {
       for (const import_def of index.imports) {
         if (import_def.import_kind === 'namespace') {
           // import * as utils from './utils'
           const namespace_symbol_id = create_namespace_symbol_id(
             import_def.local_name,
             import_def.location
           );

           const source_path = resolve_module_path(
             import_def.import_path,
             file_path
           );

           if (source_path) {
             namespace_sources.set(namespace_symbol_id, source_path);
           }
         }
       }
     }

     return {
       resolvers,
       namespace_sources
     };
   }
   ```

### Phase 2: TypeContext Integration (4-6 hours)

**Expose namespace member lookup in TypeContext**

#### File: `packages/core/src/resolve_references/type_resolution/type_context.ts`

1. **Add namespace member interface:**
   ```typescript
   interface TypeContext {
     // Existing
     get_symbol_type(symbol_id: SymbolId): SymbolId | null;
     get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null;

     // NEW: Namespace member lookup
     get_namespace_member(
       namespace_id: SymbolId,
       member_name: SymbolName
     ): SymbolId | null;
   }
   ```

2. **Implement namespace member lookup:**
   ```typescript
   function build_type_context(
     indices: ReadonlyMap<FilePath, SemanticIndex>,
     resolver_index: ScopeResolverIndex,
     cache: ResolutionCache,
     import_result: ImportResolutionResult  // NEW parameter
   ): TypeContext {
     return {
       // ... existing methods

       get_namespace_member: (namespace_id, member_name) => {
         // Step 1: Find source file for this namespace
         const source_path = import_result.namespace_sources.get(namespace_id);
         if (!source_path) return null;

         const source_index = indices.get(source_path);
         if (!source_index) return null;

         // Step 2: Find exported symbol with this name
         for (const export_def of source_index.exports) {
           if (export_def.exported_name === member_name) {
             // Step 3: Resolve the local name in source file
             return resolver_index.resolve(
               source_index.file_scope_id,
               export_def.local_name,
               cache
             );
           }
         }

         return null;
       }
     };
   }
   ```

### Phase 3: Function/Method Resolver Integration (2-4 hours)

**Update call resolvers to check for namespace members**

#### File: `packages/core/src/resolve_references/call_resolution/function_resolver.ts`

1. **Enhance function call resolution:**
   ```typescript
   function resolve_single_function_call(
     call_ref: SymbolReference,
     resolver_index: ScopeResolverIndex,
     cache: ResolutionCache,
     type_context: TypeContext
   ): SymbolId | null {
     // Check if this is a property access (namespace.member)
     const property_chain = call_ref.context?.property_chain;

     if (property_chain && property_chain.length === 2) {
       // Potential namespace access: namespace.member()
       const [namespace_name, member_name] = property_chain;

       // Step 1: Resolve namespace symbol
       const namespace_symbol = resolver_index.resolve(
         call_ref.scope_id,
         namespace_name,
         cache
       );

       if (namespace_symbol) {
         // Step 2: Try namespace member lookup
         const member_symbol = type_context.get_namespace_member(
           namespace_symbol,
           member_name
         );

         if (member_symbol) {
           return member_symbol;
         }
       }
     }

     // Fallback to regular resolution
     return resolver_index.resolve(
       call_ref.scope_id,
       call_ref.name,
       cache
     );
   }
   ```

2. **Add same logic to method_resolver.ts:**
   - Check if receiver is namespace
   - Use namespace member lookup
   - Fallback to regular type member lookup

### Phase 4: Testing (4-6 hours)

#### Test Suite: `namespace_resolution.test.ts`

1. **Basic namespace member access:**
   ```typescript
   it('resolves function call on namespace import', () => {
     // utils.ts
     const utils_code = `
       export function helper() {}
     `;

     // main.ts
     const main_code = `
       import * as utils from './utils';
       utils.helper();
     `;

     // Verify: utils.helper() resolves to utils.ts::helper
   });
   ```

2. **Multiple members:**
   ```typescript
   it('resolves multiple namespace members', () => {
     const utils_code = `
       export function a() {}
       export function b() {}
       export class C {}
     `;

     const main_code = `
       import * as utils from './utils';
       utils.a();
       utils.b();
       const obj = new utils.C();
     `;

     // All should resolve
   });
   ```

3. **Namespace vs regular type:**
   ```typescript
   it('distinguishes namespace from type', () => {
     const code = `
       import * as utils from './utils';

       class utils {  // Local class shadows namespace
         method() {}
       }

       const obj = new utils();
       obj.method();  // Should resolve to local class
       // utils.helper() would fail (shadowed)
     `;
   });
   ```

4. **Nested namespace access:**
   ```typescript
   it('does not support nested namespace access', () => {
     const code = `
       import * as outer from './outer';
       // outer.inner.helper() - not supported
     `;
     // Document as limitation
   });
   ```

5. **Re-exported namespace:**
   ```typescript
   it('handles re-exported namespace members', () => {
     // core.ts
     const core_code = `
       export function helper() {}
     `;

     // utils.ts (re-exports core)
     const utils_code = `
       export * from './core';
     `;

     // main.ts
     const main_code = `
       import * as utils from './utils';
       utils.helper();  // Should resolve to core.ts::helper
     `;
   });
   ```

6. **Language-specific tests:**
   - JavaScript: CommonJS `const utils = require('./utils')`
   - TypeScript: Type-only namespace imports
   - Python: `import utils` vs `import utils as u`
   - Rust: `use utils::*` wildcard imports

### Phase 5: Integration Testing (2-4 hours)

1. **Update language integration tests:**
   - Add namespace examples to JavaScript tests
   - Add namespace examples to TypeScript tests
   - Add namespace examples to Python tests
   - Add namespace examples to Rust tests

2. **Performance testing:**
   ```typescript
   it('namespace lookups benefit from cache', () => {
     const code = `
       import * as utils from './utils';
       utils.a();
       utils.b();
       utils.a();  // Second call to 'a' should be cached
     `;
   });
   ```

## Success Criteria

### Functional
- ✅ Simple namespace member access works
- ✅ Multiple members on same namespace work
- ✅ Namespace shadowing handled correctly
- ✅ Re-exported members work
- ✅ All 4 languages supported

### Edge Cases
- ✅ Missing namespace handled gracefully
- ✅ Missing member returns null
- ✅ Type vs namespace disambiguation
- ✅ Wildcard exports work

### Performance
- ✅ No significant slowdown
- ✅ Namespace source lookups cached
- ✅ Member lookups benefit from cache

### Testing
- ✅ 15+ new tests for namespace resolution
- ✅ Integration tests updated
- ✅ No regressions

### Code Quality
- ✅ Clear documentation
- ✅ Type-safe implementation
- ✅ Consistent patterns
- ✅ Pythonic naming

## Known Limitations

### Not Implementing (Future Work)

1. **Nested namespace access:**
   ```typescript
   import * as outer from './outer';
   outer.inner.helper();  // Not supported
   ```

2. **Dynamic namespace members:**
   ```javascript
   const utils = require('./utils');
   utils[computed_name]();  // Not supported
   ```

3. **Namespace type inference:**
   ```typescript
   function useNamespace(ns: typeof utils) {
     ns.helper();  // Not supported
   }
   ```

## Files to Modify

1. **`packages/core/src/resolve_references/import_resolution/import_resolver.ts`**
   - Add `namespace_sources` to result
   - Track namespace → source file mapping

2. **`packages/core/src/resolve_references/type_resolution/type_context.ts`**
   - Add `get_namespace_member()` method
   - Accept `ImportResolutionResult` parameter

3. **`packages/core/src/resolve_references/call_resolution/function_resolver.ts`**
   - Check for namespace member access
   - Use namespace member lookup

4. **`packages/core/src/resolve_references/call_resolution/method_resolver.ts`**
   - Add same namespace check

5. **`packages/core/src/resolve_references/symbol_resolution.ts`**
   - Pass namespace metadata through pipeline

6. **`packages/core/src/resolve_references/namespace_resolution.test.ts`** (NEW)
   - Comprehensive namespace resolution tests

## Performance Impact

**Expected:**
- Namespace source lookup: O(1) (Map access)
- Member lookup in source: O(n) where n = exported symbols
- Typical case: ~10 exports per module
- Cached after first lookup

**Worst case:**
- Large module with 100+ exports
- Still O(n) linear search
- Could add export name index if needed

## Dependencies

**Requires:**
- task-epic-11.109 (provides resolution infrastructure)
- task-epic-11.109.3 (provides import resolution base)

**Enables:**
- Complete import pattern support
- Better coverage for namespace-heavy codebases
- Foundation for wildcard exports

## Next Steps

After completion:
1. Update documentation with namespace support
2. Measure improvement in resolution coverage
3. Consider wildcard export enhancement
4. Consider nested namespace support (if needed)
