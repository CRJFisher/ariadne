# Task: Python Property Type Extraction

**Parent**: task-epic-11.150
**Status**: TODO
**Priority**: High
**Estimated Effort**: 0.75 day

## Goal

Extract type hints from Python class attributes and __init__ parameters.

## Files to Modify

1. `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
2. `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`
3. `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.test.ts`

## Implementation Steps

### Step 1: Update Python Query

```scheme
; Class attribute with type hint
(expression_statement
  (assignment
    left: (identifier) @definition.property
    type: (type) @definition.property.type
  )
) @definition.property.container

; Instance attribute in __init__
(function_definition
  name: (identifier) @_init (#eq? @_init "__init__")
  parameters: (parameters
    (typed_parameter
      (identifier) @definition.property
      type: (type) @definition.property.type
    )
  )
)
```

### Step 2: Extract Type Hints

```typescript
function extract_python_type(type_node: SyntaxNode): string {
  // Handle subscript types: List[int], Dict[str, int]
  // Handle union types: Union[str, int], Optional[str]
  // Handle plain types: str, int, MyClass
  return type_node.text;
}
```

### Step 3: Add Tests

```python
describe("Property type extraction", () => {
  it("should extract type from class attribute annotation", () => {
    const code = `
class Service:
    registry: DefinitionRegistry
    `;
    
    const index = build_semantic_index_for_test(code, "Python");
    const service_class = Array.from(index.classes.values())[0];
    const registry_prop = service_class.properties[0];
    
    expect(registry_prop.type).toBe("DefinitionRegistry");
  });
  
  it("should extract type from __init__ parameter", () => {
    const code = `
class Project:
    def __init__(self, definitions: DefinitionRegistry):
        self.definitions = definitions
    `;
    
    const index = build_semantic_index_for_test(code, "Python");
    const project_class = Array.from(index.classes.values())[0];
    const definitions_prop = project_class.properties[0];
    
    expect(definitions_prop.type).toBe("DefinitionRegistry");
  });
  
  it("should extract type from dataclass field", () => {
    const code = `
from dataclasses import dataclass, field

@dataclass
class Config:
    name: str = field(default="")
    items: List[int] = field(default_factory=list)
    `;
    
    const index = build_semantic_index_for_test(code, "Python");
    const config_class = Array.from(index.classes.values())[0];
    
    expect(config_class.properties[0].type).toBe("str");
    expect(config_class.properties[1].type).toBe("List[int]");
  });
  
  it("should extract Optional and Union types", () => {
    const code = `
from typing import Optional, Union

class Foo:
    optional_field: Optional[str]
    union_field: Union[int, str, None]
    `;
    
    const index = build_semantic_index_for_test(code, "Python");
    const foo_class = Array.from(index.classes.values())[0];
    
    expect(foo_class.properties[0].type).toBe("Optional[str]");
    expect(foo_class.properties[1].type).toBe("Union[int, str, None]");
  });
  
  it("should extract generic types", () => {
    const code = `
from typing import List, Dict

class Container:
    items: List[Item]
    mapping: Dict[str, int]
    `;
    
    const index = build_semantic_index_for_test(code, "Python");
    const container_class = Array.from(index.classes.values())[0];
    
    expect(container_class.properties[0].type).toBe("List[Item]");
    expect(container_class.properties[1].type).toBe("Dict[str, int]");
  });
});
```

## Acceptance Criteria

- [ ] Type hints extracted from class attributes
- [ ] Type hints extracted from __init__ parameters
- [ ] Dataclass fields with types extracted
- [ ] Generic types (List, Dict) preserved correctly
- [ ] Optional/Union types handled
- [ ] All 5 test cases pass
- [ ] No regressions in existing Python tests
