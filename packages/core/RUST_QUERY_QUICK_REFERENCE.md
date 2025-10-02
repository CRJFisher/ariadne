# Rust Query Patterns - Quick Reference

## ✅ Correct Patterns (Verified)

```scheme
;; ============================================================================
;; PARAMETERS
;; ============================================================================

;; Function/method parameters
(parameter
  (identifier) @definition.parameter
)

;; Self parameters (capture whole node)
(self_parameter) @definition.parameter.self

;; Closure parameters (simple)
(closure_expression
  parameters: (closure_parameters
    (identifier) @definition.parameter.closure
  )
)

;; Closure parameters (with types)
(closure_expression
  parameters: (closure_parameters
    (parameter
      (identifier) @definition.parameter.closure
    )
  )
)

;; ============================================================================
;; ENUMS
;; ============================================================================

;; Enum variants
(enum_variant
  (identifier) @definition.enum_member
)

;; ============================================================================
;; TRAITS
;; ============================================================================

;; Trait method signatures (no body)
(trait_item
  body: (declaration_list
    (function_signature_item
      (identifier) @definition.interface.method
    )
  )
)

;; Trait default methods (with body)
(trait_item
  body: (declaration_list
    (function_item
      (identifier) @definition.method.default
    )
  )
)

;; ============================================================================
;; IMPL BLOCKS
;; ============================================================================

;; Methods in impl blocks (simplified - no constraints)
(impl_item
  type: (_)
  body: (declaration_list
    (function_item
      (identifier) @definition.method
    )
  )
)

;; ============================================================================
;; GENERICS
;; ============================================================================

;; Generic functions (MUST come before general function pattern)
(function_item
  (identifier) @definition.function.generic
  type_parameters: (type_parameters)
)

;; Generic structs (MUST come before general struct pattern)
(struct_item
  (type_identifier) @definition.class.generic
  type_parameters: (type_parameters)
)
```

## ❌ Common Mistakes

```scheme
;; WRONG: Using field names for identifiers
(parameter
  pattern: (identifier) @capture  ;; ❌ 'pattern' field doesn't exist
)

;; CORRECT: Direct child
(parameter
  (identifier) @capture  ;; ✅ Direct child
)

;; ─────────────────────────────────────────────────────────────

;; WRONG: Only capturing self keyword
(self_parameter
  (self) @capture  ;; ❌ Too specific, misses '&' and mutability
)

;; CORRECT: Capture whole node
(self_parameter) @capture  ;; ✅ Captures &self, &mut self, etc.

;; ─────────────────────────────────────────────────────────────

;; WRONG: Using name field
(enum_variant
  name: (identifier) @capture  ;; ❌ 'name' field doesn't exist
)

;; CORRECT: Direct child
(enum_variant
  (identifier) @capture  ;; ✅ Direct child
)
```

## 🔍 AST Verification

```bash
# Inspect AST structure
npx tsx inspect_rust_ast.ts

# Verify all patterns
npx tsx verify_rust_queries.ts

# Test specific pattern
cat > test.ts << 'EOF'
import Parser, { Query } from "tree-sitter";
import Rust from "tree-sitter-rust";

const parser = new Parser();
parser.setLanguage(Rust);

const code = "YOUR_RUST_CODE_HERE";
const tree = parser.parse(code);

const query = new Query(Rust, "YOUR_QUERY_HERE");
const matches = query.matches(tree.rootNode);

console.log("Matches:", matches.length);
matches.forEach(m => m.captures.forEach(c =>
  console.log("  ", c.node.text)
));
EOF
npx tsx test.ts
```

## 📋 Handler Checklist

When adding a new query pattern:

1. ✅ Inspect AST structure first
2. ✅ Use direct children, not field names (unless verified)
3. ✅ Test query in isolation
4. ✅ Verify handler exists in rust_builder.ts
5. ✅ Ensure symbol ID uses full node location
6. ✅ Update documentation
7. ✅ Run full test suite

## 🎯 Symbol ID Generation

```typescript
// ✅ CORRECT: Use full node location
export function create_method_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const function_node = capture.node.parent; // Get function_item

  const location = {
    file_path: capture.location.file_path,
    start_line: function_node.startPosition.row + 1,
    start_column: function_node.startPosition.column + 1,
    end_line: function_node.endPosition.row + 1,
    end_column: function_node.endPosition.column + 1,
  };

  return method_symbol(name, location);
}

// ❌ WRONG: Use only name location
export function create_method_id(capture: CaptureNode): SymbolId {
  return method_symbol(capture.text, capture.location); // Mismatch!
}
```

## 🔗 Handler Alignment

Every query capture MUST have a handler:

| Query Capture | Handler in rust_builder.ts |
|---------------|---------------------------|
| `@definition.parameter` | `["definition.parameter", {...}]` |
| `@definition.parameter.self` | `["definition.parameter.self", {...}]` |
| `@definition.enum_member` | `["definition.enum_member", {...}]` |
| `@definition.interface.method` | `["definition.interface.method", {...}]` |
| `@definition.method` | `["definition.method", {...}]` |
| `@definition.function.generic` | `["definition.function.generic", {...}]` |

## 🚀 Quick Test

```bash
# Run Rust tests
npm test -- semantic_index.rust.test.ts

# Run specific test
npm test -- semantic_index.rust.test.ts -t "should extract function parameters"
```

## 📚 See Also

- `RUST_QUERY_PATTERNS.md` - Complete AST-to-query mapping
- `RUST_FIXES_SUMMARY.md` - What was fixed and why
- `rust.scm` - The actual query file
