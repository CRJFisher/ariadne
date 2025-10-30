# Task Epic 11.154.8.4: Fix Python/TypeScript Parameter and Decorator Edge Cases

**Parent Task**: 11.154.8
**Test Impact**: 4 tests
**Time**: 1-2 hours

---

## Failing Tests (4 total)

### TypeScript (2 tests)
1. "should extract initial values and default values correctly" - Parameter default values missing
2. "should handle all interface method parameter variations" - Optional parameters not detected

### Python (2 tests)
3. "should extract class with decorated methods (@property, @staticmethod, @classmethod)" - Decorators undefined
4. "should extract Protocol classes with property signatures" - Properties missing

---

## Solution Approach

### TypeScript Parameter Defaults

**FIX**: Builder extracts default_value from parameter node

```typescript
// In typescript_builder.ts or handler
case "definition.parameter":
  const initializer = capture.node.childForFieldName("value") ||
                      capture.node.childForFieldName("initializer");

  builder.add_parameter({
    ...
    default_value: initializer ? node_to_location(initializer, ...) : undefined
  });
```

**NO new captures** - traverse complete parameter node

### Python Decorators

**FIX**: Builder finds decorator nodes from function/class/method definition

```typescript
// When processing @definition.method/@definition.function/@definition.class:
function find_decorators(def_node: SyntaxNode): DecoratorDefinition[] {
  // Search siblings before this node for decorator nodes
  const parent = def_node.parent;
  const decorators = [];

  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child === def_node) break; // Stop at definition
    if (child?.type === "decorator") {
      // Extract decorator name and args
      decorators.push(extract_decorator(child));
    }
  }

  return decorators;
}
```

**NO new captures** - traverse from complete definition node

---

## Acceptance Criteria

- [ ] All 4 tests pass
- [ ] Parameter defaults extracted
- [ ] Optional parameters detected
- [ ] Python decorators extracted
- [ ] Protocol properties extracted
- [ ] NO new captures added
- [ ] Validation still passes

---

## Time: 1-2 hours
