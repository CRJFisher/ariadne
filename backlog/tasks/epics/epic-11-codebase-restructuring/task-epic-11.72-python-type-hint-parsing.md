---
id: task-epic-11.72
title: Parse Python Type Hints and Annotations
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, layer-3, type-analysis, python-specific]
dependencies: []
parent_task_id: epic-11
---

## Description

Implement comprehensive Python type hint parsing to extract type information from function annotations, variable annotations, and type comments. This enables proper type tracking for Python code that uses type hints.

## Context

From PROCESSING_PIPELINE.md Layer 3 (Local Type Analysis):
- Type annotation parsing is needed to understand explicit types
- Python uses PEP 484/526/544 style type hints
- Type registry needs this information for Python type resolution

Python's type hint system has evolved significantly:
- Python 3.5: PEP 484 - Type hints for functions
- Python 3.6: PEP 526 - Variable annotations
- Python 3.7: PEP 563 - Postponed annotation evaluation
- Python 3.8: PEP 544 - Protocols
- Python 3.9+: Built-in generics (list[int] instead of List[int])
- Python 3.10: PEP 604 - Union types with | operator

## Acceptance Criteria

### Function Type Hints

- [ ] Parse parameter type hints:
```python
def greet(name: str, age: int = 0) -> str:
    return f"Hello {name}"

async def fetch(url: str) -> Awaitable[dict]:
    ...
```

- [ ] Parse return type hints:
```python
def calculate() -> tuple[int, float]:
    return (1, 2.5)

def maybe_none() -> Optional[str]:
    ...
```

### Variable Type Hints

- [ ] Parse variable annotations:
```python
# Class variables
class User:
    name: str
    age: int = 0
    tags: list[str] = field(default_factory=list)

# Module-level variables
API_KEY: Final[str] = "secret"
users: dict[str, User] = {}
```

- [ ] Parse type comments (legacy):
```python
# Python 2/3.5 compatible
items = []  # type: List[str]
```

### Complex Type Expressions

- [ ] Parse generic types:
```python
# Standard generics
items: list[str]
mapping: dict[str, int]
result: Optional[User]

# Custom generics
T = TypeVar('T')
def identity(x: T) -> T: ...
```

- [ ] Parse union types:
```python
# Old style
value: Union[int, str]

# New style (3.10+)
value: int | str | None
```

- [ ] Parse literal types:
```python
mode: Literal["read", "write"]
```

- [ ] Parse Protocol types:
```python
class Drawable(Protocol):
    def draw(self) -> None: ...

def render(obj: Drawable) -> None: ...
```

### Type Alias Support

- [ ] Parse type aliases:
```python
# Simple alias
UserId = int

# Generic alias
Vector = list[float]

# Complex alias (3.10+)
type Point = tuple[float, float]
```

### Integration with Type Registry

- [ ] Create TypeAnnotation structure:
```typescript
export interface PythonTypeAnnotation {
  readonly expression: string;        // Raw annotation
  readonly resolved_type?: string;    // Resolved type name
  readonly is_optional: boolean;
  readonly is_generic: boolean;
  readonly type_parameters?: string[];
  readonly is_protocol: boolean;
  readonly is_type_alias: boolean;
}
```

- [ ] Feed parsed annotations to type registry:
  - Register type aliases
  - Track Protocol definitions
  - Store parameter and return types

## Implementation Notes

### AST Patterns to Parse

**Function annotations:**
```
function_definition
  parameters
    parameter
      identifier
      type ":"
      expression  // Type annotation
  return_type "->"
    expression    // Return annotation
```

**Variable annotations:**
```
annotated_assignment
  identifier
  type ":"
  expression      // Type annotation
  "="?
  expression?     // Optional value
```

**Type comments:**
```
comment
  "# type:"
  expression      // Type expression
```

### Type Expression Parsing

Need to parse complex type expressions:
- Subscripted generics: `list[int]`, `dict[str, Any]`
- Union types: `int | str`, `Union[int, str]`
- Optional types: `Optional[str]`, `str | None`
- Callable types: `Callable[[int, str], bool]`
- Type variables: `TypeVar('T', bound=BaseClass)`

### String Annotations

Handle forward references and string annotations:
```python
class Node:
    # Forward reference
    parent: 'Node'
    
    # String annotation (PEP 563)
    children: 'list[Node]'
```

## Testing Requirements

- [ ] Test function parameter annotations
- [ ] Test return type annotations
- [ ] Test variable annotations (class and module level)
- [ ] Test type comments
- [ ] Test complex generic types
- [ ] Test union types (both styles)
- [ ] Test Protocol definitions
- [ ] Test type aliases
- [ ] Test forward references
- [ ] Test with different Python versions

## Success Metrics

- All standard type hint patterns parsed
- Complex type expressions correctly decomposed
- Type aliases registered with type registry
- Protocol definitions extracted
- Forward references handled
- No regression in existing Python analysis

## References

- Type tracking: `/packages/core/src/type_analysis/type_tracking/`
- Python PEPs: 484, 526, 544, 563, 604
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 3)
- Type registry: Consumes parsed type information

## Notes

- Python type hints are optional but increasingly common
- Need to handle both old and new syntax styles
- String evaluation may be needed for forward references
- Consider using a specialized type hint parser library
- Runtime type information is limited compared to static languages