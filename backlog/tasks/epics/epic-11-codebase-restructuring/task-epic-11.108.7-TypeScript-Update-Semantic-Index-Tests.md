# Task 11.108.7: TypeScript - Update Semantic Index Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.3 (TypeScript processing complete)

## Objective

Update TypeScript semantic_index tests to verify all data with literal object assertions, including TypeScript-specific features like interfaces, type aliases, enums, decorators, and generic parameters.

## Test Pattern

Use complete object assertions with `toEqual()`:

```typescript
expect(definition).toEqual({
  kind: "class",
  symbol_id: expect.stringMatching(/^class:/),
  name: "MyClass",
  location: expect.objectContaining({ file_path: "test.ts" }),
  scope_id: expect.any(String),
  availability: { scope: "public" },
  methods: expect.any(Map),
  properties: expect.any(Map),
  constructor: expect.objectContaining({ parameters: expect.any(Array) }),
  // TypeScript-specific
  abstract: false,
  implements: [],
  type_parameters: ["T"],
});
```

## Coverage Required

### JavaScript Features (Inherited)
- [ ] Classes with constructors
- [ ] Constructor parameters
- [ ] Methods with parameters
- [ ] Properties
- [ ] Functions
- [ ] Arrow functions
- [ ] Variables and constants
- [ ] Imports

### TypeScript-Specific Features
- [ ] Interfaces
- [ ] Interface methods
- [ ] **Interface method parameters** (NEW)
- [ ] Interface properties
- [ ] Type aliases
- [ ] Enums
- [ ] Enum members
- [ ] Namespaces
- [ ] Decorators (class, method, property)
- [ ] Parameter properties
- [ ] Optional parameters
- [ ] Generic parameters
- [ ] Abstract classes
- [ ] Access modifiers (public, private, protected)
- [ ] Readonly properties

## Critical New Tests

### Interface Method Parameters
```typescript
it("extracts interface method parameters", () => {
  const code = `
    interface Calculator {
      add(x: number, y: number): number;
      divide(a: number, b: number, precision?: number): number;
    }
  `;

  const result = index_single_file(code, "test.ts" as FilePath, "typescript");

  const interface_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "interface" && d.name === "Calculator"
  );

  expect(interface_def).toBeDefined();
  const methods = Array.from(interface_def?.methods?.values() || []);
  expect(methods).toHaveLength(2);

  const add_method = methods.find((m) => m.name === "add");
  expect(add_method?.parameters).toHaveLength(2);
  expect(add_method?.parameters[0].name).toBe("x");
  expect(add_method?.parameters[0].type).toBe("number");
  expect(add_method?.parameters[1].name).toBe("y");
  expect(add_method?.parameters[1].type).toBe("number");

  const divide_method = methods.find((m) => m.name === "divide");
  expect(divide_method?.parameters).toHaveLength(3);
  expect(divide_method?.parameters[2].optional).toBe(true);
});
```

### Parameter Properties
```typescript
it("extracts parameter properties", () => {
  const code = `
    class Point {
      constructor(
        public x: number,
        private y: number,
        readonly z: number
      ) {}
    }
  `;

  const result = index_single_file(code, "test.ts" as FilePath, "typescript");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "Point"
  );

  expect(class_def?.properties?.size).toBe(3);

  const x_prop = Array.from(class_def?.properties?.values() || []).find(
    (p) => p.name === "x"
  );
  expect(x_prop?.access_modifier).toBe("public");
  expect(x_prop?.type).toBe("number");

  const z_prop = Array.from(class_def?.properties?.values() || []).find(
    (p) => p.name === "z"
  );
  expect(z_prop?.readonly).toBe(true);
});
```

### Decorators
```typescript
it("extracts decorators", () => {
  const code = `
    @Component({ selector: 'app-root' })
    class AppComponent {
      @Input() title: string;

      @Output()
      titleChange = new EventEmitter<string>();

      @ViewChild('content')
      contentElement: ElementRef;
    }
  `;

  const result = index_single_file(code, "test.ts" as FilePath, "typescript");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "AppComponent"
  );

  expect(class_def?.decorators).toHaveLength(1);
  expect(class_def?.decorators?.[0].name).toBe("Component");
  expect(class_def?.decorators?.[0].arguments).toContain("{ selector: 'app-root' }");

  const properties = Array.from(class_def?.properties?.values() || []);
  const title_prop = properties.find((p) => p.name === "title");
  expect(title_prop?.decorators).toHaveLength(1);
  expect(title_prop?.decorators?.[0].name).toBe("Input");
});
```

## File to Update

**File:** `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

## Success Criteria

- ✅ All TypeScript-specific features tested
- ✅ Interface method parameters verified
- ✅ Parameter properties verified
- ✅ Decorators verified
- ✅ All tests use complete object assertions
- ✅ All tests pass
