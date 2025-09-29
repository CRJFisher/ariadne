# Task: Update Python Capture Logic for Reduced Attributes

## Status: Created

## Parent Task
task-epic-11.102 - Audit and Remove Unnecessary Semantic Modifiers and CaptureContext Fields

## Objective
Update Python language configuration to support the new reduced attribute set (6 modifiers + 9 context fields) and ensure all tests pass.

## ⚠️ CRITICAL: Complete Mapping Plan First

**THIS SECTION MUST BE COMPLETED BEFORE STARTING ANY SUB-TASKS**

Before implementing any changes in sub-tasks, create a comprehensive mapping plan below that documents exactly how every Python language feature maps to the new reduced attribute structure. All sub-tasks MUST read and follow this plan.

## Python Feature → NormalizedCapture Mapping Plan

### Core Structure Mapping
```typescript
interface NormalizedCapture {
  category: SemanticCategory;    // From capture type
  entity: SemanticEntity;        // From AST node type
  node_location: Location;       // From node position
  // text: REMOVED - do not populate
  modifiers: SemanticModifiers;  // See modifiers mapping below
  context: CaptureContext;       // ALWAYS non-null, see context mapping below
}
```

### Modifiers Mapping (Max 6 fields)

| Python Feature | Modifier Field | Value | Notes |
|----------------|---------------|-------|-------|
| No prefix | `visibility` | 'public' | Default visibility |
| _name (single underscore) | `visibility` | 'internal' | Module-private convention |
| __name (double underscore) | `visibility` | 'private' | Name mangling |
| @staticmethod decorator | Infer at call | N/A | Don't set modifier, infer from call pattern |
| @classmethod decorator | Infer at call | N/A | Don't set modifier, infer from call pattern |
| async def | `is_async` | true | Async function/method |
| yield in function | `is_generator` | true | Generator function |
| @abstractmethod | `is_abstract` | true | Abstract method |
| Protocol method | `trait_type` | 'protocol' | In Protocol class |
| ABC method | `trait_type` | 'abstract_base' | In ABC class |
| await expression | `is_awaited` | true | At call site only |
| async for/for | `is_iterated` | true | At iteration site |

**IMPORTANT**: For @staticmethod and @classmethod, do NOT set is_static. Instead:
- Infer from call pattern: `Class.method()` = static
- Store decorator info in context if needed for resolution

### Context Mapping (9 fields total)

**Import fields (4 fields):**
| Python Feature | Context Field | Example Value | Notes |
|----------------|--------------|---------------|-------|
| import module | `source` | 'module' | Module being imported |
| from module import name | `imported_symbol` | 'name' | Imported symbol |
| import as alias | `local_name` | 'alias' | Local alias |
| Import type | `import_type` | 'named'/'namespace' | Import style |

**Export fields (3 fields):**
| Python Feature | Context Field | Example Value | Notes |
|----------------|--------------|---------------|-------|
| Module-level def | `exported_as` | Function name | If in __all__ |
| __all__ inclusion | `export_type` | 'named' | For public API |
| from X import Y (reexport) | `reexport_source` | 'X' | For reexports only |

**Definition fields (2 fields):**
| Python Feature | Context Field | Example Value | Notes |
|----------------|--------------|---------------|-------|
| class Child(Parent) | `extends` | 'Parent' | Base class |
| def func() -> Type | `type_name` | 'Type' | For return types, parameter types, variable types |

**Note**: Parameter names are captured in the `symbol_name` field of NormalizedCapture, not in context fields.

### Entity Mapping

| Python Node Type | SemanticEntity | Notes |
|-----------------|----------------|-------|
| function_definition | FUNCTION | Top-level or nested function |
| lambda | FUNCTION | Lambda expression |
| class_definition | CLASS | Class definition |
| function_definition (in class) | METHOD | Method in class |
| function_definition (__init__) | CONSTRUCTOR | __init__ method |
| assignment (in class) | PROPERTY | Class attribute |
| identifier (in params) | PARAMETER | Function parameter |
| assignment | VARIABLE | Variable assignment |
| import_statement | IMPORT | Import node |

### Category Mapping

| Capture Context | SemanticCategory | Notes |
|----------------|------------------|-------|
| Definition node | DEFINITION | def/class/assignment |
| Import node | IMPORT | import/from import |
| Module exports | EXPORT | If in __all__ |
| Call expression | REFERENCE | Function/method call |
| Attribute access | REFERENCE | obj.attr access |
| class/def/with/for | SCOPE | Scope boundaries |

### Python-Specific Rules

1. **Visibility from Naming Conventions**:
   ```python
   def public_func(): pass      # visibility: 'public'
   def _internal_func(): pass   # visibility: 'internal'
   def __private_func(): pass   # visibility: 'private'

   class MyClass:
       def public_method(self): pass     # visibility: 'public'
       def _protected(self): pass        # visibility: 'internal'
       def __private(self): pass         # visibility: 'private'
   ```

2. **Method Type Detection**:
   ```python
   class MyClass:
       def instance_method(self): pass       # Regular method (has self)

       @staticmethod
       def static_method(): pass              # Don't set is_static, infer from call

       @classmethod
       def class_method(cls): pass           # Don't set is_static, infer from call

       @abstractmethod
       def abstract_method(self): pass        # is_abstract: true
   ```

3. **Protocol/ABC Detection**:
   ```python
   from typing import Protocol
   from abc import ABC, abstractmethod

   class MyProtocol(Protocol):        # Methods have trait_type: 'protocol'
       def required_method(self): ...

   class MyABC(ABC):                 # Methods have trait_type: 'abstract_base'
       @abstractmethod
       def abstract_method(self): pass
   ```

### Examples of Complete Mappings

```python
# Input: class DataProcessor(ABC):
#            @abstractmethod
#            async def process(self, data): ...

# Class capture
{
  category: DEFINITION,
  entity: CLASS,
  node_location: { start: 0, end: 100 },
  modifiers: {
    visibility: 'public'
  },
  context: {
    extends: 'ABC'
  }
}

# Abstract async method capture
{
  category: DEFINITION,
  entity: METHOD,
  node_location: { start: 30, end: 90 },
  modifiers: {
    is_abstract: true,
    is_async: true,
    trait_type: 'abstract_base',
    visibility: 'public'
  },
  context: {
    type_name: null  // No type hint in this example
    // Note: method parameter 'self' captured separately as symbol_name
  }
}
```

## Implementation Instructions for Sub-tasks

**ALL SUB-TASKS MUST**:
1. Read this complete mapping plan before starting
2. Follow the mappings exactly as specified above
3. Use naming conventions for visibility inference
4. Store decorators in context, not modifiers
5. Ensure context is ALWAYS non-null (use {} if empty)
6. NEVER populate the text field
7. Reference specific rows from the mapping tables when implementing

## Sub-tasks

### 1. [task-epic-11.102.3.1] Update Language Config
- **File**: `packages/core/src/parse_and_query_code/language_configs/python.ts`
- **Actions**:
  - Remove mappings for deprecated modifiers
  - Map naming conventions to visibility (_private, __private → visibility enum)
  - Map decorators (@staticmethod, @classmethod, @abstractmethod)
  - Remove Python-specific fields (__all__ handling, parameter_name, return_type, etc.)
  - Replace return_type with generic type_name field
  - Add inference logic for static vs instance methods
  - Map Protocol/ABC methods to trait_type

### 2. [task-epic-11.102.3.2] Update Query File
- **File**: `packages/core/src/parse_and_query_code/queries/python.scm`
- **Actions**:
  - Remove captures for deprecated attributes
  - Ensure decorator captures for @staticmethod, @classmethod, @abstractmethod
  - Capture naming patterns for visibility inference
  - Ensure import/from/as captures align with new structure
  - Remove text capture if present

### 3. [task-epic-11.102.3.3] Update Tests
- **File**: `packages/core/src/parse_and_query_code/language_configs/python.test.ts`
- **Actions**:
  - Update test expectations for new structure
  - Add tests for visibility inference from naming
  - Add tests for type_name field (return types, parameter types, variable types)
  - Add tests for decorator-based modifiers
  - Add tests for async def and generators
  - Ensure 100% coverage of new fields
  - Verify context is non-null (9 fields: 4 import + 3 export + 2 definition)
  - Verify parameter names captured in symbol_name, not context

## Python-Specific Considerations

### Visibility Mapping
- Default (no prefix) → 'public'
- `_name` (single underscore) → 'internal' (module-private by convention)
- `__name` (double underscore) → 'private' (name mangling)
- Module-level with `__all__` → Check if in __all__ for 'public' vs 'internal'

### Import/Export Patterns
```python
import module                    # import_type: 'namespace'
from module import name          # import_type: 'named'
from module import name as alias # import_type: 'named', local_name: 'alias'
import module as alias           # import_type: 'namespace', local_name: 'alias'
from . import module            # relative imports tracked in source
```

### Method Type Detection
```python
class MyClass:
    def instance_method(self): pass     # Regular method (inferred)

    @staticmethod
    def static_method(): pass            # Static (from decorator)

    @classmethod
    def class_method(cls): pass          # Class method (treat as static)

    @abstractmethod
    def abstract_method(self): pass      # is_abstract: true
```

### Async/Generator Detection
- `async def` → is_async: true
- Functions with `yield` → is_generator: true
- `await` expressions → is_awaited: true
- `async for` → is_iterated: true

### Protocol/ABC Detection
```python
from typing import Protocol
from abc import ABC, abstractmethod

class MyProtocol(Protocol):     # trait_type: 'protocol'
    def method(self): ...

class MyABC(ABC):               # Methods have trait_type: 'abstract_base'
    @abstractmethod
    def method(self): pass
```

### Static Method Inference
```python
# From decorator
@staticmethod
def func(): pass

# From first parameter
def method(self): pass    # Instance (has self)
def method(cls): pass     # Class method (has cls)
def method(): pass        # Static (no self/cls)

# From call pattern
MyClass.method()          # Infer static from receiver
instance.method()         # Infer instance from receiver
```

## Expected Outcome
- Python captures use only the 6 essential modifiers
- Decorator-based modifiers work correctly
- Visibility inferred from naming conventions
- Protocol/ABC detection works
- Context contains only the 9 essential fields (4 import + 3 export + 2 definition)
- All tests pass

## Dependencies
- Parent task task-epic-11.102 must define final interface structure

## Testing Checklist
- [ ] Visibility inference from naming works
- [ ] @staticmethod/@classmethod detected
- [ ] @abstractmethod detected
- [ ] Protocol/ABC trait_type works
- [ ] async/await detection works
- [ ] Generator detection works
- [ ] Import patterns mapped correctly
- [ ] Context is always non-null
- [ ] No Python-specific fields remain