# Task 11.109.9.3: Python Integration Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1-2 days
**Parent:** task-epic-11.109.9
**Dependencies:** task-epic-11.109.8 (Main orchestration)

## Objective

Create comprehensive integration tests for Python that validate symbol resolution with Python-specific features: relative imports, packages (`__init__.py`), class methods with `self`, decorators, and Python module resolution.

## File to Create

**Single test file:**
- `packages/core/src/resolve_references/symbol_resolution.python.test.ts`

## Implementation

### Test Structure

```typescript
/**
 * Python Integration Tests
 *
 * Tests Python-specific features: relative imports, packages,
 * self parameter, decorators, and Python module resolution
 */

import { resolve_symbols } from "./symbol_resolution";
import { create_semantic_index_from_code } from "../test_helpers/index_builder";
import type { SemanticIndex, FilePath } from "@ariadnejs/types";

describe("Python Symbol Resolution Integration", () => {
  describe("Function Calls", () => {
    it("resolves local function call", () => {
      // Test implementation
    });

    it("resolves imported function call", () => {
      // Test implementation
    });

    it("resolves function from relative import", () => {
      // Test implementation
    });
  });

  describe("Method Calls", () => {
    it("resolves method call with self parameter", () => {
      // Test implementation
    });

    it("resolves method call on instance variable", () => {
      // Test implementation
    });

    it("resolves class method (@classmethod)", () => {
      // Test implementation
    });

    it("resolves static method (@staticmethod)", () => {
      // Test implementation
    });
  });

  describe("Relative Imports", () => {
    it("resolves single-dot relative import (same directory)", () => {
      // Test implementation
    });

    it("resolves double-dot relative import (parent directory)", () => {
      // Test implementation
    });

    it("resolves multi-level relative import", () => {
      // Test implementation
    });
  });

  describe("Package Imports", () => {
    it("resolves import from __init__.py", () => {
      // Test implementation
    });

    it("resolves nested package import", () => {
      // Test implementation
    });
  });

  describe("Complex Scenarios", () => {
    it("resolves full workflow: import → instantiate → method call", () => {
      // Test implementation
    });

    it("resolves method call through inheritance", () => {
      // Test implementation
    });
  });
});
```

## Key Test Scenarios

### 1. Basic Method Call with Self

**Code:**
```python
# user.py
class User:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name

# main.py
from user import User

def main():
    user = User("Alice")
    name = user.get_name()  # Should resolve to User.get_name
```

**Test:**
```typescript
it("resolves method call with self parameter", () => {
  const user_code = `
class User:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name
  `;

  const main_code = `
from user import User

def main():
    user = User("Alice")
    name = user.get_name()
  `;

  const user_index = create_semantic_index_from_code(user_code, "user.py", "python");
  const main_index = create_semantic_index_from_code(main_code, "main.py", "python");

  const indices = new Map([
    ["user.py", user_index],
    ["main.py", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Verify constructor call
  const user_call = find_reference_by_name(main_index, "User", "constructor");
  const User_class = find_definition(user_index, "User", "class");
  expect(resolved.resolved_references.get(location_key(user_call.location)))
    .toBe(User_class.symbol_id);

  // Verify method call
  const get_name_call = find_reference_by_name(main_index, "get_name", "method");
  const get_name_method = find_class_method(user_index, "User", "get_name");
  expect(resolved.resolved_references.get(location_key(get_name_call.location)))
    .toBe(get_name_method.symbol_id);
});
```

### 2. Relative Imports (Single Dot)

**Code:**
```python
# utils/helper.py
def process():
    return 42

# utils/worker.py
from .helper import process

def work():
    return process()  # Should resolve to helper.process
```

**Test:**
```typescript
it("resolves single-dot relative import (same directory)", () => {
  const helper_code = `
def process():
    return 42
  `;

  const worker_code = `
from .helper import process

def work():
    return process()
  `;

  const helper_index = create_semantic_index_from_code(helper_code, "utils/helper.py", "python");
  const worker_index = create_semantic_index_from_code(worker_code, "utils/worker.py", "python");

  const indices = new Map([
    ["utils/helper.py", helper_index],
    ["utils/worker.py", worker_index]
  ]);

  const resolved = resolve_symbols(indices);

  const process_call = find_reference_by_name(worker_index, "process", "function");
  const process_def = find_definition(helper_index, "process", "function");

  expect(resolved.resolved_references.get(location_key(process_call.location)))
    .toBe(process_def.symbol_id);
});
```

### 3. Parent Directory Import (Double Dot)

**Code:**
```python
# models/user.py
class User:
    pass

# services/user_service.py
from ..models.user import User

class UserService:
    def create_user(self):
        return User()  # Should resolve to models/user.User
```

**Test:**
```typescript
it("resolves double-dot relative import (parent directory)", () => {
  const user_code = `
class User:
    pass
  `;

  const service_code = `
from ..models.user import User

class UserService:
    def create_user(self):
        return User()
  `;

  const user_index = create_semantic_index_from_code(user_code, "models/user.py", "python");
  const service_index = create_semantic_index_from_code(service_code, "services/user_service.py", "python");

  const indices = new Map([
    ["models/user.py", user_index],
    ["services/user_service.py", service_index]
  ]);

  const resolved = resolve_symbols(indices);

  const User_call = find_reference_by_name(service_index, "User", "constructor");
  const User_class = find_definition(user_index, "User", "class");

  expect(resolved.resolved_references.get(location_key(User_call.location)))
    .toBe(User_class.symbol_id);
});
```

### 4. Package Import (__init__.py)

**Code:**
```python
# utils/__init__.py
from .helper import helper_function

# main.py
from utils import helper_function

def main():
    helper_function()  # Should resolve through __init__.py to utils/helper.py
```

**Test:**
```typescript
it("resolves import from __init__.py", () => {
  const helper_code = `
def helper_function():
    return 42
  `;

  const init_code = `
from .helper import helper_function
  `;

  const main_code = `
from utils import helper_function

def main():
    helper_function()
  `;

  const helper_index = create_semantic_index_from_code(helper_code, "utils/helper.py", "python");
  const init_index = create_semantic_index_from_code(init_code, "utils/__init__.py", "python");
  const main_index = create_semantic_index_from_code(main_code, "main.py", "python");

  const indices = new Map([
    ["utils/helper.py", helper_index],
    ["utils/__init__.py", init_index],
    ["main.py", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  const helper_call = find_reference_by_name(main_index, "helper_function", "function");
  const helper_def = find_definition(helper_index, "helper_function", "function");

  expect(resolved.resolved_references.get(location_key(helper_call.location)))
    .toBe(helper_def.symbol_id);
});
```

### 5. Class Method and Static Method

**Code:**
```python
# config.py
class Config:
    @classmethod
    def load(cls):
        return Config()

    @staticmethod
    def validate():
        return True

# main.py
from config import Config

def main():
    config = Config.load()      # Class method call
    valid = Config.validate()   # Static method call
```

**Test:**
```typescript
it("resolves class method and static method", () => {
  const config_code = `
class Config:
    @classmethod
    def load(cls):
        return Config()

    @staticmethod
    def validate():
        return True
  `;

  const main_code = `
from config import Config

def main():
    config = Config.load()
    valid = Config.validate()
  `;

  const config_index = create_semantic_index_from_code(config_code, "config.py", "python");
  const main_index = create_semantic_index_from_code(main_code, "main.py", "python");

  const indices = new Map([
    ["config.py", config_index],
    ["main.py", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Class method call
  const load_call = find_reference_by_name(main_index, "load", "method");
  const load_method = find_class_method(config_index, "Config", "load");
  expect(resolved.resolved_references.get(location_key(load_call.location)))
    .toBe(load_method.symbol_id);

  // Static method call
  const validate_call = find_reference_by_name(main_index, "validate", "method");
  const validate_method = find_class_method(config_index, "Config", "validate");
  expect(resolved.resolved_references.get(location_key(validate_call.location)))
    .toBe(validate_method.symbol_id);
});
```

### 6. Method Call Through Inheritance

**Code:**
```python
# base.py
class Base:
    def base_method(self):
        return "base"

# derived.py
from base import Base

class Derived(Base):
    def derived_method(self):
        return self.base_method()  # Should resolve to Base.base_method

# main.py
from derived import Derived

def main():
    obj = Derived()
    obj.base_method()    # Should resolve to Base.base_method
    obj.derived_method() # Should resolve to Derived.derived_method
```

**Test:**
```typescript
it("resolves method call through inheritance", () => {
  const base_code = `
class Base:
    def base_method(self):
        return "base"
  `;

  const derived_code = `
from base import Base

class Derived(Base):
    def derived_method(self):
        return self.base_method()
  `;

  const main_code = `
from derived import Derived

def main():
    obj = Derived()
    obj.base_method()
    obj.derived_method()
  `;

  const base_index = create_semantic_index_from_code(base_code, "base.py", "python");
  const derived_index = create_semantic_index_from_code(derived_code, "derived.py", "python");
  const main_index = create_semantic_index_from_code(main_code, "main.py", "python");

  const indices = new Map([
    ["base.py", base_index],
    ["derived.py", derived_index],
    ["main.py", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Call to base_method in main.py
  const base_method_call_main = find_reference_by_location(main_index, { line: 5, column: 8 });
  const base_method = find_class_method(base_index, "Base", "base_method");
  expect(resolved.resolved_references.get(location_key(base_method_call_main.location)))
    .toBe(base_method.symbol_id);

  // Call to derived_method in main.py
  const derived_method_call = find_reference_by_location(main_index, { line: 6, column: 8 });
  const derived_method = find_class_method(derived_index, "Derived", "derived_method");
  expect(resolved.resolved_references.get(location_key(derived_method_call.location)))
    .toBe(derived_method.symbol_id);

  // Call to base_method inside Derived class
  const base_method_call_derived = find_reference_by_location(derived_index, { line: 5, column: 15 });
  expect(resolved.resolved_references.get(location_key(base_method_call_derived.location)))
    .toBe(base_method.symbol_id);
});
```

### 7. Full Workflow with Repository Pattern

**Code:**
```python
# models/user.py
class User:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name

# repositories/user_repository.py
from ..models.user import User

class UserRepository:
    def save(self, user):
        return True

    def create_user(self, name):
        return User(name)

# services/user_service.py
from ..repositories.user_repository import UserRepository

class UserService:
    def __init__(self):
        self.repo = UserRepository()

    def register_user(self, name):
        user = self.repo.create_user(name)
        self.repo.save(user)
        return user.get_name()

# main.py
from services.user_service import UserService

def main():
    service = UserService()
    name = service.register_user("Alice")
```

**Test:**
```typescript
it("resolves full workflow: import → instantiate → method call", () => {
  const user_code = `
class User:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name
  `;

  const repository_code = `
from ..models.user import User

class UserRepository:
    def save(self, user):
        return True

    def create_user(self, name):
        return User(name)
  `;

  const service_code = `
from ..repositories.user_repository import UserRepository

class UserService:
    def __init__(self):
        self.repo = UserRepository()

    def register_user(self, name):
        user = self.repo.create_user(name)
        self.repo.save(user)
        return user.get_name()
  `;

  const main_code = `
from services.user_service import UserService

def main():
    service = UserService()
    name = service.register_user("Alice")
  `;

  const user_index = create_semantic_index_from_code(user_code, "models/user.py", "python");
  const repository_index = create_semantic_index_from_code(repository_code, "repositories/user_repository.py", "python");
  const service_index = create_semantic_index_from_code(service_code, "services/user_service.py", "python");
  const main_index = create_semantic_index_from_code(main_code, "main.py", "python");

  const indices = new Map([
    ["models/user.py", user_index],
    ["repositories/user_repository.py", repository_index],
    ["services/user_service.py", service_index],
    ["main.py", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Verify UserService constructor in main.py
  const service_call = find_reference_by_name(main_index, "UserService", "constructor");
  const UserService_class = find_definition(service_index, "UserService", "class");
  expect(resolved.resolved_references.get(location_key(service_call.location)))
    .toBe(UserService_class.symbol_id);

  // Verify register_user method call in main.py
  const register_user_call = find_reference_by_name(main_index, "register_user", "method");
  const register_user_method = find_class_method(service_index, "UserService", "register_user");
  expect(resolved.resolved_references.get(location_key(register_user_call.location)))
    .toBe(register_user_method.symbol_id);

  // Verify UserRepository constructor in UserService.__init__
  const repo_call = find_reference_by_name(service_index, "UserRepository", "constructor");
  const UserRepository_class = find_definition(repository_index, "UserRepository", "class");
  expect(resolved.resolved_references.get(location_key(repo_call.location)))
    .toBe(UserRepository_class.symbol_id);

  // Verify create_user method call in register_user
  const create_user_call = find_reference_by_name(service_index, "create_user", "method");
  const create_user_method = find_class_method(repository_index, "UserRepository", "create_user");
  expect(resolved.resolved_references.get(location_key(create_user_call.location)))
    .toBe(create_user_method.symbol_id);

  // Verify User constructor call in create_user
  const user_call = find_reference_by_name(repository_index, "User", "constructor");
  const User_class = find_definition(user_index, "User", "class");
  expect(resolved.resolved_references.get(location_key(user_call.location)))
    .toBe(User_class.symbol_id);
});
```

## Python-Specific Features to Test

### Import System
1. **Absolute imports** - `from package.module import name`
2. **Relative imports** - `from . import`, `from .. import`, `from ...package import`
3. **Package imports** - `from package import` → `package/__init__.py`
4. **Star imports** - `from module import *` (if supported)
5. **Aliased imports** - `from module import name as alias`

### Class Features
1. **Instance methods** - `def method(self)`
2. **Class methods** - `@classmethod def method(cls)`
3. **Static methods** - `@staticmethod def method()`
4. **Magic methods** - `__init__`, `__str__`, etc.
5. **Inheritance** - Method resolution order
6. **Multiple inheritance** - Diamond pattern

### Scope Features
1. **Function-level imports** - `import` inside function
2. **Nested functions** - Functions inside functions
3. **Closures** - Inner function accessing outer variables
4. **List comprehensions** - `[x for x in items]` (separate scope)

## Success Criteria

### Functional
- ✅ Relative imports resolve correctly (`.`, `..`, `...`)
- ✅ Package imports resolve through `__init__.py`
- ✅ Method calls with `self` resolve correctly
- ✅ Class methods and static methods resolve correctly
- ✅ Inheritance method resolution works
- ✅ Full multi-file workflows resolve end-to-end

### Coverage
- ✅ At least 15 Python-specific integration tests
- ✅ Tests cover relative imports at all levels
- ✅ Tests cover package structure
- ✅ Tests cover Python class features
- ✅ Tests use realistic Python patterns

### Quality
- ✅ Tests use actual Python indexing pipeline
- ✅ Tests validate import resolution
- ✅ Clear test names and assertions
- ✅ Fast execution (<100ms per test)

## Dependencies

**Uses:**
- task-epic-11.109.8 (Main orchestration)
- Python indexing pipeline
- Python module resolver (11.109.3)
- Test helpers from previous tests

**Validates:**
- Python-specific resolution
- Relative import resolution
- Package structure resolution
- Python class method resolution

## Notes

### Python Import Complexity

Python imports are notably complex:
1. **Relative vs absolute** - Different resolution rules
2. **Package structure** - `__init__.py` affects resolution
3. **Project root** - Finding package boundaries
4. **Implicit imports** - Some imports affect namespace

### Testing Strategy

Focus on:
1. **Multi-file projects** with proper package structure
2. **Relative imports** at various nesting levels
3. **Cross-package references** (services calling models)
4. **Inheritance chains** for method resolution

## Next Steps

After completion:
- Create Rust tests (11.109.9.4)
- Compare module resolution across all languages
- Document any language-specific quirks found
