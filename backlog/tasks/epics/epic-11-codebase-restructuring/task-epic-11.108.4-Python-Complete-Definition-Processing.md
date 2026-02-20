# Task 11.108.4: Python - Complete Definition Processing

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.1 (builder enhancements)

## Objective

Complete Python definition tracking by:
- Migrating constructors to dedicated API
- Adding decorator tracking (currently extracted but discarded)
- Verifying all Python-specific features work

## Current Status

Python builder has good coverage but critical gaps:
- ✅ Classes, methods, functions tracked
- ✅ Parameters tracked (including *args, **kwargs)
- ✅ Properties and fields tracked
- ✅ Imports tracked
- ⚠️ Constructors (__init__) added as methods
- ❌ Decorators extracted but NEVER applied via `add_decorator_to_target`

## Changes Required

### 1. Migrate Constructor Handling

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`

**Current code (line 452-475):**
```typescript
[
  "definition.constructor",
  {
    process: (capture, builder, context) => {
      // __init__ method - treat as constructor
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_method_to_class(class_id, {  // ❌ Wrong method
          symbol_id: method_id,
          name: "constructor" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "public" },
          return_type: undefined,
        });
      }
    },
  },
],
```

**New code:**
```typescript
[
  "definition.constructor",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_constructor_to_class(class_id, {  // ✅ Dedicated API
          symbol_id: method_id,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "public" },
        });
      }
    },
  },
],
```

**Also check line 361-374** where __init__ is handled in `definition.method`:
```typescript
if (name === "__init__") {
  // __init__ is actually a constructor
  builder.add_method_to_class(class_id, {
    symbol_id: method_id,
    name: "constructor" as SymbolName,
    // ...
  });
}
```

**This should be removed** - `definition.constructor` should handle all __init__ methods.

### 2. Add Decorator Tracking

**Current state:** `extract_decorators()` helper exists (line 173-193) but results are discarded!

**Example of extraction:**
```typescript
function extract_decorators(node: SyntaxNode): SymbolName[] {
  const decorators: SymbolName[] = [];

  const parent = node.parent;
  if (parent && parent.type === "decorated_definition") {
    const decoratorNodes = parent.children.filter(
      (child) => child.type === "decorator"
    );
    for (const decorator of decoratorNodes) {
      const identifier = decorator.children.find(
        (child) => child.type === "identifier"
      );
      if (identifier) {
        decorators.push(identifier.text as SymbolName);
      }
    }
  }

  return decorators;
}
```

**Problem:** This function is called nowhere!

**Solution 1: Add decorator handling for classes**

```typescript
[
  "definition.class",
  {
    process: (capture, builder, context) => {
      const class_id = create_class_id(capture);
      const base_classes = extract_extends(capture.node.parent || capture.node);

      builder.add_class({
        symbol_id: class_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: determine_availability(capture.text),
        extends: base_classes,
      });

      // NEW: Add decorators
      const decorators = extract_decorators(capture.node.parent || capture.node);
      for (const decorator of decorators) {
        builder.add_decorator_to_target(class_id, {
          name: decorator,
          arguments: [], // TODO: Extract decorator arguments
          location: capture.location,
        });
      }
    },
  },
],
```

**Solution 2: Add decorator handling for methods**

```typescript
[
  "definition.method",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);
      const class_id = find_containing_class(capture);
      const name = capture.text;

      if (class_id) {
        const methodType = determine_method_type(capture.node.parent || capture.node);
        const isAsync = is_async_function(capture.node.parent || capture.node);

        if (name === "__init__") {
          // This should be removed - handled by definition.constructor
        } else {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: name,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(name),
            return_type: extract_return_type(capture.node.parent || capture.node),
            ...methodType,
            async: isAsync,
          });

          // NEW: Add decorators
          const decorators = extract_decorators(capture.node.parent || capture.node);
          for (const decorator of decorators) {
            builder.add_decorator_to_target(method_id, {
              name: decorator,
              arguments: [],
              location: capture.location,
            });
          }
        }
      }
    },
  },
],
```

**Solution 3: Add decorator handling for properties**

```typescript
[
  "definition.property",
  {
    process: (capture, builder, context) => {
      const prop_id = create_property_id(capture);
      const class_id = find_containing_class(capture);

      if (class_id) {
        builder.add_property_to_class(class_id, {
          symbol_id: prop_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
          readonly: true, // Properties decorated with @property are readonly
        });

        // NEW: Add decorators
        const decorators = extract_decorators(capture.node.parent || capture.node);
        for (const decorator of decorators) {
          builder.add_decorator_to_target(prop_id, {
            name: decorator,
            arguments: [],
            location: capture.location,
          });
        }
      }
    },
  },
],
```

### 3. Enhance Decorator Extraction

**Current `extract_decorators` only gets names, not arguments.**

**Enhanced version:**
```typescript
interface DecoratorInfo {
  name: SymbolName;
  arguments: string[];
  location: Location;
}

function extract_decorators_with_args(node: SyntaxNode): DecoratorInfo[] {
  const decorators: DecoratorInfo[] = [];

  const parent = node.parent;
  if (parent && parent.type === "decorated_definition") {
    const decoratorNodes = parent.children.filter(
      (child) => child.type === "decorator"
    );

    for (const decorator of decoratorNodes) {
      // Decorator structure: @ identifier ( arguments )
      let name: SymbolName | undefined;
      const args: string[] = [];

      for (const child of decorator.children) {
        if (child.type === "identifier") {
          name = child.text as SymbolName;
        } else if (child.type === "argument_list") {
          // Extract arguments
          for (const arg of child.children) {
            if (arg.type !== "(" && arg.type !== ")" && arg.type !== ",") {
              args.push(arg.text);
            }
          }
        }
      }

      if (name) {
        decorators.push({
          name,
          arguments: args,
          location: extract_location(decorator),
        });
      }
    }
  }

  return decorators;
}
```

### 4. Verify All Python-Specific Features

| Definition Type | Capture Name | Builder Method | Status |
|----------------|--------------|----------------|--------|
| Class | `definition.class` | `add_class` | ✅ |
| Constructor (__init__) | `definition.constructor` | `add_constructor_to_class` | ⚠️ Update |
| Method | `definition.method` | `add_method_to_class` | ✅ |
| Static Method | `definition.method.static` | `add_method_to_class` | ✅ |
| Class Method | `definition.method.class` | `add_method_to_class` | ✅ |
| Function | `definition.function` | `add_function` | ✅ |
| Async Function | `definition.function.async` | `add_function` | ✅ |
| Lambda | `definition.lambda` | `add_function` | ✅ |
| Parameter | `definition.parameter` | `add_parameter_to_callable` | ✅ |
| Parameter (default) | `definition.parameter.default` | `add_parameter_to_callable` | ✅ |
| Parameter (typed) | `definition.parameter.typed` | `add_parameter_to_callable` | ✅ |
| *args | `definition.parameter.args` | `add_parameter_to_callable` | ✅ |
| **kwargs | `definition.parameter.kwargs` | `add_parameter_to_callable` | ✅ |
| Property (@property) | `definition.property` | `add_property_to_class` | ✅ |
| Field | `definition.field` | `add_property_to_class` | ✅ |
| Variable | `definition.variable` | `add_variable` | ✅ |
| Import | `import.named` | `add_import` | ✅ |
| Import module | `import.module` | `add_import` | ✅ |
| Import star | `import.star` | `add_import` | ✅ |
| **Decorators** | N/A | `add_decorator_to_target` | ❌ Add |

## Query File Verification

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/python.scm`

**Verify decorators are accessible:**

Python decorators are part of `decorated_definition` nodes:
```scheme
; Decorated classes
(decorated_definition
  (decorator)* @decorator
  definition: (class_definition
    name: (identifier) @definition.class))

; Decorated functions/methods
(decorated_definition
  (decorator)* @decorator
  definition: (function_definition
    name: (identifier) @definition.method))
```

**No query changes needed** - decorators are accessible via node traversal.

## Testing Changes

**File:** `packages/core/src/index_single_file/semantic_index.python.test.ts`

**Add test for decorators:**
```typescript
it("should extract class decorators", () => {
  const code = `
@dataclass
class MyClass:
    x: int
    y: str
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "MyClass"
  );

  expect(class_def).toBeDefined();
  expect(class_def?.decorators).toHaveLength(1);
  expect(class_def?.decorators?.[0].name).toBe("dataclass");
});

it("should extract method decorators", () => {
  const code = `
class MyClass:
    @property
    def x(self):
        return self._x

    @staticmethod
    def create():
        return MyClass()
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "MyClass"
  );

  expect(class_def).toBeDefined();

  const x_method = Array.from(class_def?.methods?.values() || []).find(
    (m) => m.name === "x"
  );
  expect(x_method?.decorators).toHaveLength(1);
  expect(x_method?.decorators?.[0].name).toBe("property");

  const create_method = Array.from(class_def?.methods?.values() || []).find(
    (m) => m.name === "create"
  );
  expect(create_method?.decorators).toHaveLength(1);
  expect(create_method?.decorators?.[0].name).toBe("staticmethod");
});

it("should extract constructor with parameters", () => {
  const code = `
class MyClass:
    def __init__(self, x: int, y: str = "default"):
        self.x = x
        self.y = y
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "MyClass"
  );

  expect(class_def).toBeDefined();
  expect(class_def?.constructor).toBeDefined();
  expect(class_def?.constructor?.parameters).toHaveLength(3); // self, x, y
  expect(class_def?.constructor?.parameters[0].name).toBe("self");
  expect(class_def?.constructor?.parameters[1].name).toBe("x");
  expect(class_def?.constructor?.parameters[1].type).toBe("int");
  expect(class_def?.constructor?.parameters[2].name).toBe("y");
  expect(class_def?.constructor?.parameters[2].type).toBe("str");
  expect(class_def?.constructor?.parameters[2].default_value).toBe('"default"');
});
```

### 5. Add TypeAlias Support (NEW)

**Issue:** Python 3.10+ supports explicit type aliases, but we don't track them!

**Example:**
```python
from typing import TypeAlias

Point: TypeAlias = tuple[int, int]
Vector: TypeAlias = list[float]
```

**Add handler:**
```typescript
[
  "definition.type_alias",
  {
    process: (capture, builder, context) => {
      const type_id = type_symbol(capture.text, capture.location);

      builder.add_type({
        kind: "type_alias",
        symbol_id: type_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: determine_availability(capture.text),
        type_expression: extract_type_alias_expression(capture.node),
      });
    },
  },
],
```

**Helper function:**
```typescript
function extract_type_alias_expression(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent?.type === "annotated_assignment") {
    const valueNode = parent.childForFieldName?.("value");
    return valueNode?.text;
  }
  return undefined;
}
```

**Query update (`python.scm`):**
```scheme
; Type alias (Python 3.10+)
(annotated_assignment
  target: (identifier) @definition.type_alias
  annotation: (type
    (identifier) @_type_alias_marker)
  (#eq? @_type_alias_marker "TypeAlias"))
```

## Implementation Steps

1. **Update constructor handling:**
   - Change `add_method_to_class` to `add_constructor_to_class`
   - Remove __init__ special case from `definition.method`

2. **Add decorator tracking:**
   - Enhance `extract_decorators` to include arguments
   - Call `add_decorator_to_target` in class/method/property handlers

3. **Add TypeAlias support:**
   - Add query capture in `python.scm`
   - Add handler in `python_builder.ts`
   - Add helper function for type expression extraction

4. **Add Enum support (CRITICAL):**
   - Add query to detect Enum inheritance
   - Add handler for `definition.enum`
   - Add handler for `definition.enum.member`
   - Add helper functions for enum detection

5. **Add Protocol support (optional - medium priority):**
   - Add query to detect Protocol inheritance
   - Treat as interface with `add_interface`
   - Add property signature support

6. **Add tests:**
   - Constructor with parameters
   - Class decorators
   - Method decorators (property, staticmethod, classmethod)
   - Type aliases
   - **Enums and enum members (CRITICAL)**
   - Protocols with properties (optional)

7. **Compile and test:**
   ```bash
   npx tsc --noEmit packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts
   npm test -- semantic_index.python.test.ts
   ```

### 6. Add Enum Support (NEW - CRITICAL)

**Issue:** Python has `Enum` class from `enum` module, but we don't track enums at all!

**Example:**
```python
from enum import Enum, IntEnum, StrEnum

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3

class Status(StrEnum):
    PENDING = "pending"
    COMPLETE = "complete"
```

**Challenge:** Enum is not a keyword, it's a base class. Need to detect class inheritance.

**Solution:**

**Query (`python.scm`):**
```scheme
; Enum classes - detect classes inheriting from Enum
(class_definition
  name: (identifier) @definition.enum
  superclasses: (argument_list
    (identifier) @_enum_base
    (#match? @_enum_base "^(Enum|IntEnum|StrEnum|Flag|IntFlag)$")))

; Enum members - class variables in Enum classes
(class_definition
  superclasses: (argument_list
    (identifier) @_enum_base
    (#match? @_enum_base "^(Enum|IntEnum|StrEnum|Flag|IntFlag)$"))
  body: (block
    (expression_statement
      (assignment
        left: (identifier) @definition.enum.member))))
```

**Handler:**
```typescript
[
  "definition.enum",
  {
    process: (capture, builder, context) => {
      const enum_id = create_enum_id(capture);

      builder.add_enum({
        symbol_id: enum_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: determine_availability(capture.text),
        is_const: false, // Python enums are not const
      });
    },
  },
],

[
  "definition.enum.member",
  {
    process: (capture, builder, context) => {
      const enum_id = find_containing_enum(capture);
      if (!enum_id) return;

      const member_id = create_enum_member_id(capture, enum_id);

      builder.add_enum_member(enum_id, {
        symbol_id: member_id,
        name: capture.text,
        location: capture.location,
        value: extract_enum_member_value(capture.node),
      });
    },
  },
],
```

**Helper functions:**
```typescript
function create_enum_id(capture: CaptureNode): SymbolId {
  return `enum:${capture.location.file_path}:${capture.location.start_line}:${capture.text}` as SymbolId;
}

function create_enum_member_id(capture: CaptureNode, enum_id: SymbolId): SymbolId {
  return `${enum_id}::${capture.text}` as SymbolId;
}

function extract_enum_member_value(node: SyntaxNode): string | number | undefined {
  const parent = node.parent;
  if (parent?.type === "assignment") {
    const valueNode = parent.childForFieldName?.("right");
    if (valueNode) {
      // Try to parse as number
      const numVal = parseFloat(valueNode.text);
      if (!isNaN(numVal)) return numVal;
      // Return as string (may be string literal or expression)
      return valueNode.text;
    }
  }
  return undefined;
}

function find_containing_enum(capture: CaptureNode): SymbolId | undefined {
  let node = capture.node.parent;
  while (node) {
    if (node.type === "class_definition") {
      // Check if this class inherits from Enum
      const superclasses = node.childForFieldName?.("superclasses");
      if (superclasses) {
        for (const child of superclasses.children || []) {
          if (child.type === "identifier" &&
              /^(Enum|IntEnum|StrEnum|Flag|IntFlag)$/.test(child.text)) {
            const nameNode = node.childForFieldName?.("name");
            if (nameNode) {
              const location = extract_location(nameNode);
              return `enum:${location.file_path}:${location.start_line}:${nameNode.text}` as SymbolId;
            }
          }
        }
      }
    }
    node = node.parent;
  }
  return undefined;
}
```

**Test:**
```typescript
it("extracts enums and enum members", () => {
  const code = `
from enum import Enum

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const enum_def = Array.from(result.enums?.values() || []).find(
    (e) => e.name === "Color"
  );

  expect(enum_def).toBeDefined();
  expect(enum_def?.kind).toBe("enum");
  expect(enum_def?.members).toHaveLength(3);

  const red_member = enum_def?.members.find((m) => m.name === "RED");
  expect(red_member).toBeDefined();
  expect(red_member?.value).toBe(1);
});
```

### 7. Add Protocol Property Support (NEW - Medium Priority)

**Issue:** Python 3.8+ has `Protocol` for structural typing with property signatures, but we don't track them!

**Example:**
```python
from typing import Protocol

class Drawable(Protocol):
    color: str      # ← property signature
    width: int      # ← property signature

    def draw(self) -> None: ...
```

**Solution:**

Treat Protocols as interfaces:

**Query:**
```scheme
; Protocol classes - detect classes inheriting from Protocol
(class_definition
  name: (identifier) @definition.interface
  superclasses: (argument_list
    (identifier) @_protocol_base
    (#eq? @_protocol_base "Protocol")))

; Protocol properties - annotated assignments
(class_definition
  superclasses: (argument_list
    (identifier) @_protocol_base
    (#eq? @_protocol_base "Protocol"))
  body: (block
    (expression_statement
      (assignment
        left: (identifier) @definition.interface.property
        type: (_)))))
```

**Handlers:** Similar to TypeScript interface processing

**Priority:** Medium - less common than Enum, but still used

## Success Criteria

- ✅ Constructor uses `add_constructor_to_class`
- ✅ Decorators tracked for classes, methods, properties
- ✅ Decorator arguments extracted
- ✅ __init__ special case removed from method handler
- ✅ **Enum support added (CRITICAL)**
- ✅ **Enum members tracked**
- ⚠️ **Protocol property support added (optional - medium priority)**
- ✅ TypeAlias support added
- ✅ All tests pass

## Related Files

- [python_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts)
- [python.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/python.scm)
- [semantic_index.python.test.ts](../../../packages/core/src/index_single_file/semantic_index.python.test.ts)

## Notes

Python's decorator system is powerful and widely used (@dataclass, @property, @staticmethod, etc.). Currently, the builder extracts this information but discards it! Adding decorator tracking will significantly improve semantic analysis for Python code.
