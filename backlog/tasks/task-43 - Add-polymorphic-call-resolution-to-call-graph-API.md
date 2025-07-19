---
id: task-43
title: Add polymorphic call resolution to call graph API
status: To Do
assignee: []
created_date: "2025-07-19"
updated_date: "2025-07-19"
labels: []
dependencies:
  - task-35
---

## Description

Enable the call graph to resolve method calls to specific implementation classes rather than abstract base classes or interfaces. When analyzing polymorphic code, users should be able to specify which concrete implementations they want to trace, allowing for more accurate call graphs that reflect actual runtime behavior.

## Acceptance Criteria

- [ ] API supports specifying implementation mappings
- [ ] Correctly resolves interface/abstract method calls to concrete implementations
- [ ] Handles multiple inheritance and interface implementations
- [ ] Works with TypeScript interfaces and abstract classes
- [ ] Works with Python abstract base classes and duck typing
- [ ] Supports method override resolution
- [ ] Maintains backward compatibility with existing API
- [ ] Unit tests verify polymorphic resolution
- [ ] Integration tests cover complex inheritance scenarios
- [ ] Performance remains acceptable with resolution overhead

## Feasibility Analysis

This feature is **highly feasible** with the current architecture. Here's why:

1. **Existing Infrastructure**:

   - We already have class/interface definitions tracked in the scope graph
   - Method definitions include metadata about their containing class
   - The symbol naming system (module#Class.method) supports class-specific resolution

2. **Required Enhancements**:

   - Add inheritance tracking to understand class hierarchies
   - Extend CallGraphOptions to accept implementation mappings
   - Modify call resolution logic to check mappings before resolving

3. **Complexity Considerations**:
   - Need to handle multiple inheritance (Python) and interface implementations (TypeScript)
   - Duck typing in Python requires special handling
   - Method resolution order (MRO) needs to be respected

## Proposed API Design

```typescript
interface PolymorphicMapping {
  // Map from abstract/interface symbol to concrete implementation symbol
  [abstractSymbol: string]: string;
}

interface CallGraphOptions {
  include_external?: boolean;
  max_depth?: number;
  file_filter?: (path: string) => boolean;
  // New option for polymorphic resolution
  implementation_mappings?: PolymorphicMapping;
}

// Example usage:
const callGraph = project.get_call_graph({
  implementation_mappings: {
    "models#Storage.save": "models#PostgresStorage.save",
    "models#Storage.load": "models#PostgresStorage.load",
    "interfaces#Logger.log": "utils#ConsoleLogger.log",
  },
});
```

## Implementation Approach

### Phase 1: Inheritance Tracking

1. Extend the scope graph to track class inheritance relationships
2. Add parent class/interface information to class definitions
3. Build inheritance chains for method resolution

### Phase 2: Resolution Logic

1. When resolving a method call on an abstract class/interface:

   - Check if there's a mapping in implementation_mappings
   - If yes, resolve to the specified implementation
   - If no, fall back to current behavior (resolve to abstract method)

2. Handle edge cases:
   - Multiple inheritance (Python): Follow MRO
   - Interface implementation (TypeScript): Check all implemented interfaces
   - Method overrides: Ensure correct method is selected

### Phase 3: Testing & Performance

1. Create test fixtures with complex inheritance hierarchies
2. Benchmark performance impact of additional resolution steps
3. Optimize hot paths if needed

## Example Use Cases

### TypeScript Example

```typescript
interface Database {
  query(sql: string): Promise<any>;
}

class PostgresDB implements Database {
  async query(sql: string) {
    // Postgres-specific implementation
  }
}

class MongoDB implements Database {
  async query(sql: string) {
    // MongoDB-specific implementation
  }
}

function processData(db: Database) {
  return db.query("SELECT * FROM users");
}
```

With polymorphic resolution, users could trace calls through `processData` to see either PostgresDB.query or MongoDB.query based on their configuration.

### Python Example

```python
from abc import ABC, abstractmethod

class Storage(ABC):
    @abstractmethod
    def save(self, data):
        pass

class FileStorage(Storage):
    def save(self, data):
        # Save to file
        pass

class S3Storage(Storage):
    def save(self, data):
        # Save to S3
        pass

def backup_data(storage: Storage, data):
    storage.save(data)
```

Users could specify whether they want to trace FileStorage.save or S3Storage.save paths.

## Dependencies

This task depends on:

- task-35: Get call graph API (completed)
- task-40: Symbol naming convention (completed)

## Estimated Complexity

- **Medium-High**: Requires understanding of OOP concepts across languages
- **Time estimate**: 3-5 days for full implementation with tests
- **Risk**: Main complexity is handling language-specific inheritance patterns
