# Task Epic 11.154.7.1: Fix Rust Import Builder (Remove Fragment Captures)

**Parent Task**: 11.154.7 - Fix Rust Query Captures
**Status**: Pending (CRITICAL)
**Priority**: CRITICAL (blocking validation)
**Complexity**: Medium
**Time Estimate**: 2-3 hours

---

## Problem

Agent incorrectly added `@import.import` fragment captures back to rust.scm, creating **16 validation errors**.

**Current rust.scm** (WRONG):
```scheme
(use_declaration
  argument: (scoped_identifier
    (identifier) @import.import      ← FRAGMENT on child node!
  )
)
```

**Validation result**: ❌ 16 errors (`@import.import` not in schema)

---

## Objective

Remove all `@import.import` fragment captures and restore Rust import functionality via **builder logic** that extracts from complete `use_declaration` nodes.

---

## The Correct Pattern: Complete Capture + Builder Extraction

### In rust.scm (Query File)

```scheme
; Simple use declarations
(use_declaration) @definition.import

; Extern crate declarations
(extern_crate_declaration) @definition.import

; Public re-exports
(use_declaration
  (visibility_modifier)
) @export.reexport
```

**That's it!** Three patterns capturing complete nodes.

### In rust_builder.ts (Builder Logic)

Add handler that extracts import details from complete node:

```typescript
case "definition.import":
  const node = capture.node; // Complete use_declaration or extern_crate_declaration

  if (node.type === "use_declaration") {
    const arg = node.childForFieldName("argument");
    if (!arg) break;

    // Handle different use patterns by argument type
    switch (arg.type) {
      case "identifier":
        // Simple: use foo
        const name = arg.text;
        builder.add_import({ name, module_path: name, ... });
        break;

      case "scoped_identifier":
        // Scoped: use std::fmt::Display
        const path = extract_scoped_path(arg); // std::fmt
        const name = arg.childForFieldName("name")?.text; // Display
        builder.add_import({ name, module_path: path, ... });
        break;

      case "use_list":
        // List: use std::{Display, Debug}
        for (let i = 0; i < arg.childCount; i++) {
          const item = arg.child(i);
          if (item?.type === "identifier") {
            builder.add_import({ name: item.text, ... });
          } else if (item?.type === "use_as_clause") {
            // Handle aliased items in list
            const name = item.childForFieldName("path")?.text;
            const alias = item.childForFieldName("alias")?.text;
            builder.add_import({ name, alias, ... });
          }
        }
        break;

      case "scoped_use_list":
        // List with path: use std::fmt::{Display, Debug}
        const path = arg.childForFieldName("path");
        const list = arg.childForFieldName("list");
        // Extract path, then process list items
        break;

      case "use_as_clause":
        // Alias: use foo as bar
        const original = arg.childForFieldName("path");
        const alias = arg.childForFieldName("alias");
        builder.add_import({ name: original?.text, alias: alias?.text, ... });
        break;

      case "use_wildcard":
        // Wildcard: use foo::*
        const wildcard_path = extract_path_from_use_wildcard(arg);
        builder.add_import({ wildcard: true, module_path: wildcard_path, ... });
        break;
    }
  } else if (node.type === "extern_crate_declaration") {
    // Handle extern crate similarly
    const name_node = node.childForFieldName("name");
    builder.add_import({ name: name_node?.text, ... });
  }
  break;
```

**Helper functions**:
```typescript
function extract_scoped_path(scoped_id: SyntaxNode): string {
  // Traverse scoped_identifier to build path like "std::fmt"
  const parts: string[] = [];
  let current = scoped_id;

  while (current && current.type === "scoped_identifier") {
    const name = current.childForFieldName("name");
    if (name) parts.push(name.text);

    const path = current.childForFieldName("path");
    current = path;
  }

  return parts.reverse().join("::");
}
```

---

## Implementation Steps

### Step 1: Remove Fragment Captures from rust.scm (0.5 hour)

Remove all patterns with `@import.import`:
- Lines with `(identifier) @import.import`
- Lines with use_list items
- All fragment patterns

Keep only:
```scheme
(use_declaration) @definition.import
(extern_crate_declaration) @definition.import
(use_declaration (visibility_modifier)) @export.reexport
```

### Step 2: Implement Builder Handler (1.5 hours)

In `rust_builder.ts`, add comprehensive `"definition.import"` handler:
- Handle all use_declaration argument types
- Extract names, paths, aliases
- Support lists, wildcards, scoped paths
- Create multiple import definitions from one capture

### Step 3: Test and Validate (0.5 hour)

```bash
npm run build
npm run validate:captures -- --lang=rust  # Must show 0 errors
npm test -- rust                          # Check Rust tests
```

### Step 4: Verify Import Resolution (0.5 hour)

Run integration tests to ensure:
- Imports resolve correctly
- Module paths work
- Aliases work
- Wildcards work

---

## Acceptance Criteria

- [ ] rust.scm has NO `@import.import` captures
- [ ] Validation: `npm run validate:captures -- --lang=rust` shows 0 errors, 0 warnings
- [ ] Builder handler processes all use_declaration types
- [ ] Rust import tests pass
- [ ] No fragment captures reintroduced
- [ ] Complete capture principle maintained

---

## Why This Matters

**This is a test of our principles**:
- Will we stick to complete captures when it's hard?
- Or reintroduce fragments for convenience?

**The right way**:
- One complete capture
- Builder does the work
- Maintainable, no duplicates

**The wrong way**:
- Multiple fragment captures
- "Easy" but breaks our architecture
- Technical debt

---

## Time: 2-3 hours

- Query cleanup: 0.5 hour
- Builder implementation: 1.5 hours
- Testing: 0.5 hour
- Buffer: 0.5 hour
