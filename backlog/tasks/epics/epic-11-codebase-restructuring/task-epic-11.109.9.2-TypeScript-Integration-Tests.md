# Task 11.109.9.2: TypeScript Integration Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1-2 days
**Parent:** task-epic-11.109.9
**Dependencies:** task-epic-11.109.8 (Main orchestration)

## Objective

Create comprehensive integration tests for TypeScript that validate symbol resolution with type annotations, interfaces, generics, and TypeScript-specific module resolution. Ensure type tracking works correctly for method resolution.

## File to Create

**Single test file:**
- `packages/core/src/resolve_references/symbol_resolution.typescript.test.ts`

## Implementation

### Test Structure

```typescript
/**
 * TypeScript Integration Tests
 *
 * Tests TypeScript-specific features: type annotations, interfaces,
 * generics, type-based method resolution, and TS module resolution
 */

import { resolve_symbols } from "./symbol_resolution";
import { create_semantic_index_from_code } from "../test_helpers/index_builder";
import type { SemanticIndex, FilePath } from "@ariadnejs/types";

describe("TypeScript Symbol Resolution Integration", () => {
  describe("Type Annotations", () => {
    it("resolves method call using explicit type annotation", () => {
      // Test implementation
    });

    it("resolves method call using inferred type from constructor", () => {
      // Test implementation
    });

    it("resolves method call using return type annotation", () => {
      // Test implementation
    });
  });

  describe("Interfaces", () => {
    it("resolves method call on interface-typed variable", () => {
      // Test implementation
    });

    it("resolves method call through interface import", () => {
      // Test implementation
    });
  });

  describe("Generics", () => {
    it("resolves method call on generic class instance", () => {
      // Test implementation
    });

    it("resolves method with generic parameters", () => {
      // Test implementation
    });
  });

  describe("Module Resolution", () => {
    it("resolves import with .ts extension omitted", () => {
      // Test implementation
    });

    it("resolves import from index.ts", () => {
      // Test implementation
    });

    it("resolves import with path alias (future)", () => {
      // Test implementation - mark as pending
    });
  });

  describe("Mixed JS/TS", () => {
    it("resolves TypeScript importing JavaScript", () => {
      // Test implementation
    });

    it("resolves method call on JS class from TS", () => {
      // Test implementation
    });
  });

  describe("Complex Scenarios", () => {
    it("resolves method chain with generic return types", () => {
      // Test implementation
    });

    it("resolves full workflow with interfaces and implementations", () => {
      // Test implementation
    });
  });
});
```

## Key Test Scenarios

### 1. Explicit Type Annotation

**Code:**
```typescript
// user.ts
export class User {
  getName(): string {
    return "Alice";
  }
}

// main.ts
import { User } from './user';

function main() {
  const user: User = getUser();  // Explicit type annotation
  const name = user.getName();    // Should resolve via type annotation
}

function getUser(): any {
  return new User();
}
```

**Test:**
```typescript
it("resolves method call using explicit type annotation", () => {
  const user_code = `
    export class User {
      getName(): string { return "Alice"; }
    }
  `;

  const main_code = `
    import { User } from './user';
    function main() {
      const user: User = getUser();
      const name = user.getName();
    }
    function getUser(): any { return new User(); }
  `;

  const user_index = create_semantic_index_from_code(user_code, "user.ts", "typescript");
  const main_index = create_semantic_index_from_code(main_code, "main.ts", "typescript");

  const indices = new Map([
    ["user.ts", user_index],
    ["main.ts", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Verify getName() resolves to User.getName
  const getName_call = find_reference_by_name(main_index, "getName", "method");
  const getName_method = find_class_method(user_index, "User", "getName");

  expect(resolved.resolved_references.get(location_key(getName_call.location)))
    .toBe(getName_method.symbol_id);
});
```

### 2. Interface-Based Method Resolution

**Code:**
```typescript
// types.ts
export interface IRepository {
  save(data: any): boolean;
}

// repository.ts
import { IRepository } from './types';

export class UserRepository implements IRepository {
  save(data: any): boolean {
    return true;
  }
}

// main.ts
import { IRepository } from './types';
import { UserRepository } from './repository';

function main() {
  const repo: IRepository = new UserRepository();
  repo.save({ name: "Alice" });  // Should resolve to UserRepository.save
}
```

**Test:**
```typescript
it("resolves method call on interface-typed variable", () => {
  const types_code = `
    export interface IRepository {
      save(data: any): boolean;
    }
  `;

  const repository_code = `
    import { IRepository } from './types';
    export class UserRepository implements IRepository {
      save(data: any): boolean { return true; }
    }
  `;

  const main_code = `
    import { IRepository } from './types';
    import { UserRepository } from './repository';
    function main() {
      const repo: IRepository = new UserRepository();
      repo.save({ name: "Alice" });
    }
  `;

  const types_index = create_semantic_index_from_code(types_code, "types.ts", "typescript");
  const repository_index = create_semantic_index_from_code(repository_code, "repository.ts", "typescript");
  const main_index = create_semantic_index_from_code(main_code, "main.ts", "typescript");

  const indices = new Map([
    ["types.ts", types_index],
    ["repository.ts", repository_index],
    ["main.ts", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // The variable is typed as IRepository, but actual instance is UserRepository
  // Type tracking should use constructor type (UserRepository), not annotation type
  const save_call = find_reference_by_name(main_index, "save", "method");
  const save_method = find_class_method(repository_index, "UserRepository", "save");

  expect(resolved.resolved_references.get(location_key(save_call.location)))
    .toBe(save_method.symbol_id);
});
```

### 3. Generic Class

**Code:**
```typescript
// container.ts
export class Container<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }
}

// main.ts
import { Container } from './container';

function main() {
  const container = new Container<string>("hello");
  const value = container.getValue();  // Should resolve to Container.getValue
}
```

**Test:**
```typescript
it("resolves method call on generic class instance", () => {
  const container_code = `
    export class Container<T> {
      private value: T;
      constructor(value: T) { this.value = value; }
      getValue(): T { return this.value; }
    }
  `;

  const main_code = `
    import { Container } from './container';
    function main() {
      const container = new Container<string>("hello");
      const value = container.getValue();
    }
  `;

  const container_index = create_semantic_index_from_code(container_code, "container.ts", "typescript");
  const main_index = create_semantic_index_from_code(main_code, "main.ts", "typescript");

  const indices = new Map([
    ["container.ts", container_index],
    ["main.ts", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Constructor call
  const container_call = find_reference_by_name(main_index, "Container", "constructor");
  const Container_class = find_definition(container_index, "Container", "class");
  expect(resolved.resolved_references.get(location_key(container_call.location)))
    .toBe(Container_class.symbol_id);

  // Method call
  const getValue_call = find_reference_by_name(main_index, "getValue", "method");
  const getValue_method = find_class_method(container_index, "Container", "getValue");
  expect(resolved.resolved_references.get(location_key(getValue_call.location)))
    .toBe(getValue_method.symbol_id);
});
```

### 4. TypeScript Module Resolution

**Code:**
```typescript
// utils/index.ts
export function helper() {
  return 42;
}

// main.ts
import { helper } from './utils';  // Resolves to utils/index.ts

function main() {
  helper();
}
```

**Test:**
```typescript
it("resolves import from index.ts", () => {
  const utils_code = `export function helper() { return 42; }`;
  const main_code = `
    import { helper } from './utils';
    function main() {
      helper();
    }
  `;

  const utils_index = create_semantic_index_from_code(utils_code, "utils/index.ts", "typescript");
  const main_index = create_semantic_index_from_code(main_code, "main.ts", "typescript");

  const indices = new Map([
    ["utils/index.ts", utils_index],
    ["main.ts", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  const helper_call = find_reference_by_name(main_index, "helper", "function");
  const helper_def = find_definition(utils_index, "helper", "function");

  expect(resolved.resolved_references.get(location_key(helper_call.location)))
    .toBe(helper_def.symbol_id);
});
```

### 5. Mixed TypeScript/JavaScript

**Code:**
```typescript
// legacy.js
export class LegacyService {
  doSomething() {
    return true;
  }
}

// modern.ts
import { LegacyService } from './legacy';

function main() {
  const service = new LegacyService();
  service.doSomething();  // Should resolve to JS class method
}
```

**Test:**
```typescript
it("resolves TypeScript importing JavaScript", () => {
  const legacy_code = `
    export class LegacyService {
      doSomething() { return true; }
    }
  `;

  const modern_code = `
    import { LegacyService } from './legacy';
    function main() {
      const service = new LegacyService();
      service.doSomething();
    }
  `;

  const legacy_index = create_semantic_index_from_code(legacy_code, "legacy.js", "javascript");
  const modern_index = create_semantic_index_from_code(modern_code, "modern.ts", "typescript");

  const indices = new Map([
    ["legacy.js", legacy_index],
    ["modern.ts", modern_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Constructor call
  const service_call = find_reference_by_name(modern_index, "LegacyService", "constructor");
  const LegacyService_class = find_definition(legacy_index, "LegacyService", "class");
  expect(resolved.resolved_references.get(location_key(service_call.location)))
    .toBe(LegacyService_class.symbol_id);

  // Method call
  const doSomething_call = find_reference_by_name(modern_index, "doSomething", "method");
  const doSomething_method = find_class_method(legacy_index, "LegacyService", "doSomething");
  expect(resolved.resolved_references.get(location_key(doSomething_call.location)))
    .toBe(doSomething_method.symbol_id);
});
```

### 6. Return Type Inference

**Code:**
```typescript
// user.ts
export class User {
  getName(): string {
    return "Alice";
  }
}

// factory.ts
import { User } from './user';

export function createUser(): User {
  return new User();
}

// main.ts
import { createUser } from './factory';

function main() {
  const user = createUser();  // Type inferred from return type
  user.getName();              // Should resolve using inferred type
}
```

**Test:**
```typescript
it("resolves method call using return type annotation", () => {
  const user_code = `
    export class User {
      getName(): string { return "Alice"; }
    }
  `;

  const factory_code = `
    import { User } from './user';
    export function createUser(): User {
      return new User();
    }
  `;

  const main_code = `
    import { createUser } from './factory';
    function main() {
      const user = createUser();
      user.getName();
    }
  `;

  const user_index = create_semantic_index_from_code(user_code, "user.ts", "typescript");
  const factory_index = create_semantic_index_from_code(factory_code, "factory.ts", "typescript");
  const main_index = create_semantic_index_from_code(main_code, "main.ts", "typescript");

  const indices = new Map([
    ["user.ts", user_index],
    ["factory.ts", factory_index],
    ["main.ts", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // TypeContext should track:
  // - createUser() has return type User
  // - user variable gets type User from call
  // - getName() resolves to User.getName
  const getName_call = find_reference_by_name(main_index, "getName", "method");
  const getName_method = find_class_method(user_index, "User", "getName");

  expect(resolved.resolved_references.get(location_key(getName_call.location)))
    .toBe(getName_method.symbol_id);
});
```

## TypeScript-Specific Features to Test

### Type System Features
1. **Type annotations** - `const x: Type = value`
2. **Interface types** - `interface I { method(): void }`
3. **Type aliases** - `type UserId = string`
4. **Generics** - `class Box<T>`
5. **Union types** - `string | number`
6. **Intersection types** - `A & B`
7. **Return type inference** - `function(): Type`

### Module Resolution
1. **.ts extension omitted** - `import './file'` → `file.ts`
2. **Index files** - `import './dir'` → `dir/index.ts`
3. **Declaration files** - `.d.ts` (future)
4. **Path aliases** - `@/utils` from tsconfig.json (future)
5. **JS interop** - TS importing JS files

### Language Features
1. **Decorators** - `@Component` (metadata tracking)
2. **Abstract classes** - `abstract class Base`
3. **Method overloading** - Multiple signatures
4. **Optional chaining** - `obj?.method()`
5. **Nullish coalescing** - `value ?? default`

## Success Criteria

### Functional
- ✅ Type annotations used for method resolution
- ✅ Interface-typed variables resolve correctly
- ✅ Generic classes resolve correctly
- ✅ Return type inference works
- ✅ TypeScript module resolution works (index.ts, omitted extensions)
- ✅ Mixed TS/JS projects work
- ✅ All shadowing and scope rules work

### Coverage
- ✅ At least 15 TypeScript-specific integration tests
- ✅ Tests cover type-based resolution
- ✅ Tests cover TS module resolution rules
- ✅ Tests cover JS/TS interop
- ✅ Tests use realistic TypeScript code

### Quality
- ✅ Tests use actual TypeScript indexing pipeline
- ✅ Type tracking validated end-to-end
- ✅ Clear test names and assertions
- ✅ Fast execution (<100ms per test)

## Dependencies

**Uses:**
- task-epic-11.109.8 (Main orchestration)
- task-epic-11.109.4 (TypeContext for type tracking)
- TypeScript indexing pipeline
- Test helpers from JavaScript tests (11.109.9.1)

**Validates:**
- TypeScript-specific resolution
- Type-based method resolution
- TS module resolution
- JS/TS interoperability

## Notes

### TypeScript vs JavaScript Testing

**Differences from JavaScript tests:**
1. Type annotations drive method resolution
2. Interfaces need special handling
3. Generics complicate type tracking
4. Module resolution has TS-specific rules
5. JS interop needs validation

**Similarities:**
- Same resolution pipeline
- Same scope rules
- Same import/export chains
- Same test helper structure

### Future Enhancements

Features to test when implemented:
- Path aliases from tsconfig.json
- Declaration files (.d.ts)
- Type-only imports (`import type`)
- Namespace imports with types
- Conditional types
- Template literal types

## Next Steps

After completion:
- Create Python tests (11.109.9.3)
- Create Rust tests (11.109.9.4)
- Compare type tracking across languages
