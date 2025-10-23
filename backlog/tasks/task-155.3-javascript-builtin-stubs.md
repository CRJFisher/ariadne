# Task 155.3: JavaScript Built-in Type Stubs

**Parent**: task-155
**Dependencies**: task-155.1 (design), task-155.2 (implementation)
**Status**: TODO
**Priority**: High
**Estimated Effort**: 1 day

## Goal

Create comprehensive type stubs for JavaScript built-in methods that describe how types flow through them.

## Scope

Cover the most commonly used JavaScript built-in methods:
- **Array methods**: `map`, `filter`, `reduce`, `find`, `forEach`, `flatMap`, `some`, `every`
- **Promise methods**: `then`, `catch`, `finally`, `all`, `race`
- **Map/Set methods**: `forEach`, `get`, `set`
- **Object methods**: `keys`, `values`, `entries`, `fromEntries`

**Out of scope**:
- String methods (usually return strings, simple)
- Number methods (no type flow)
- Third-party libraries (only built-ins)

## Stub File Location

Create: `type_stubs/javascript.json`

## Stub Definitions

### Array Methods

```json
{
  "language": "javascript",
  "stubs": {
    "Array.prototype.map": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "element_type"
        },
        "callback_param:1": {
          "from": "literal",
          "value": "number"
        },
        "return": {
          "from": "callback_return",
          "transform": "array_of"
        }
      }
    },
    "Array.prototype.filter": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "element_type"
        },
        "return": {
          "from": "receiver",
          "transform": "identity"
        }
      }
    },
    "Array.prototype.reduce": {
      "infer_rules": {
        "callback_param:0": {
          "from": "call_argument:1",
          "transform": "identity"
        },
        "callback_param:1": {
          "from": "receiver",
          "transform": "element_type"
        },
        "return": {
          "from": "callback_return | call_argument:1"
        }
      }
    },
    "Array.prototype.find": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "element_type"
        },
        "return": {
          "from": "receiver",
          "transform": "element_type"
        }
      }
    },
    "Array.prototype.forEach": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "element_type"
        },
        "return": {
          "from": "literal",
          "value": "undefined"
        }
      }
    },
    "Array.prototype.flatMap": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "element_type"
        },
        "return": {
          "from": "callback_return",
          "transform": "flatten_array"
        }
      }
    },
    "Array.prototype.some": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "element_type"
        },
        "return": {
          "from": "literal",
          "value": "boolean"
        }
      }
    },
    "Array.prototype.every": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "element_type"
        },
        "return": {
          "from": "literal",
          "value": "boolean"
        }
      }
    }
  }
}
```

### Promise Methods

```json
{
  "Promise.prototype.then": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "resolved_type"
      },
      "return": {
        "from": "callback_return",
        "transform": "promise_of"
      }
    }
  },
  "Promise.prototype.catch": {
    "infer_rules": {
      "callback_param:0": {
        "from": "literal",
        "value": "Error"
      },
      "return": {
        "from": "receiver",
        "transform": "identity"
      }
    }
  },
  "Promise.prototype.finally": {
    "infer_rules": {
      "callback_param:0": {
        "from": "literal",
        "value": "void"
      },
      "return": {
        "from": "receiver",
        "transform": "identity"
      }
    }
  },
  "Promise.all": {
    "infer_rules": {
      "return": {
        "from": "call_argument:0",
        "transform": "promise_all_result"
      }
    }
  },
  "Promise.race": {
    "infer_rules": {
      "return": {
        "from": "call_argument:0",
        "transform": "promise_race_result"
      }
    }
  }
}
```

### Map/Set Methods

```json
{
  "Map.prototype.get": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "map_value_type"
      }
    }
  },
  "Map.prototype.set": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "identity"
      }
    }
  },
  "Map.prototype.forEach": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "map_value_type"
      },
      "callback_param:1": {
        "from": "receiver",
        "transform": "map_key_type"
      },
      "return": {
        "from": "literal",
        "value": "undefined"
      }
    }
  },
  "Set.prototype.forEach": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "set_element_type"
      },
      "return": {
        "from": "literal",
        "value": "undefined"
      }
    }
  }
}
```

### Object Methods

```json
{
  "Object.keys": {
    "infer_rules": {
      "return": {
        "from": "literal",
        "value": "Array<string>"
      }
    }
  },
  "Object.values": {
    "infer_rules": {
      "return": {
        "from": "call_argument:0",
        "transform": "object_values_type"
      }
    }
  },
  "Object.entries": {
    "infer_rules": {
      "return": {
        "from": "call_argument:0",
        "transform": "object_entries_type"
      }
    }
  },
  "Object.fromEntries": {
    "infer_rules": {
      "return": {
        "from": "call_argument:0",
        "transform": "object_from_entries_type"
      }
    }
  }
}
```

## New Transform Operations Needed

If task-155.2 doesn't already support these, add them:

1. **`flatten_array`**: `Array<Array<T>>` → `Array<T>`
2. **`map_value_type`**: `Map<K, V>` → `V`
3. **`map_key_type`**: `Map<K, V>` → `K`
4. **`set_element_type`**: `Set<T>` → `T`
5. **`object_values_type`**: `{ k: V }` → `Array<V>`
6. **`object_entries_type`**: `{ k: V }` → `Array<[string, V]>`
7. **`promise_all_result`**: `Array<Promise<T>>` → `Promise<Array<T>>`
8. **`promise_race_result`**: `Array<Promise<T>>` → `Promise<T>`
9. **`literal`**: Special source that provides a hardcoded type

## Testing

Create test cases for each stub:

### Array.reduce Test
```typescript
// Test case from original problem
const results = captures
  .reduce(
    (builder, capture) => builder.process(capture),
    new ReferenceBuilder(context, extractors, file_path)
  );

// Expected: builder type = ReferenceBuilder
// Expected: builder.process() resolves to ReferenceBuilder.process()
```

### Array.map Test
```typescript
const users: User[] = [...];
const names = users.map(user => user.getName());

// Expected: user type = User
// Expected: user.getName() resolves to User.getName()
```

### Promise.then Test
```typescript
const userPromise: Promise<User> = fetchUser();
const name = userPromise.then(user => user.getName());

// Expected: user type = User
// Expected: user.getName() resolves to User.getName()
```

### Map.forEach Test
```typescript
const userMap: Map<string, User> = new Map();
userMap.forEach((user, id) => {
  user.getName();  // Should resolve
});

// Expected: user type = User
// Expected: id type = string
```

## Files to Create

1. `type_stubs/javascript.json` - The stub definitions
2. `packages/core/src/resolve_references/type_stubs/javascript_stubs.test.ts` - Integration tests

## Files to Modify

1. `packages/core/src/resolve_references/type_stubs/rule_evaluator.ts`
   - Add new transform operations if needed
   - Add `literal` source type

## Acceptance Criteria

- [ ] All Array methods stubbed (map, filter, reduce, find, forEach, flatMap, some, every)
- [ ] All Promise methods stubbed (then, catch, finally, all, race)
- [ ] Map/Set methods stubbed (get, set, forEach)
- [ ] Object methods stubbed (keys, values, entries, fromEntries)
- [ ] New transform operations implemented
- [ ] All stub tests pass
- [ ] Original Array.reduce problem case works
- [ ] Documentation added for each stub (comments in JSON)

## Priority Order

Implement in this order (most impactful first):

1. **Array.reduce** - Original problem case
2. **Array.map** - Very common
3. **Promise.then** - Async code patterns
4. **Array.filter** - Common pattern
5. **Array.find** - Common pattern
6. Others as time permits

## Success Criteria

The specific case from `reference_builder.ts` must work:
```typescript
.reduce(
  (builder, capture) => builder.process(capture),
  new ReferenceBuilder(context, extractors, file_path)
)
```

And common JavaScript patterns should work:
```typescript
const users = await api.getUsers();  // Promise<User[]>
const names = users.map(u => u.getName());  // User.getName() resolves
```

## Notes

- Start with the most common methods first
- Test each stub in isolation
- Consider adding JSDoc comments to explain each stub
- Some stubs may be incomplete (e.g., Promise.all is complex) - document limitations
