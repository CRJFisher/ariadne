# Task 155.5: Python Built-in Type Stubs

**Parent**: task-155
**Dependencies**: task-155.1, task-155.2
**Status**: TODO
**Priority**: High
**Estimated Effort**: 1 day

## Goal

Create type stubs for Python built-in methods and common patterns that describe how types flow through them.

## Scope

Cover commonly used Python built-in functions and methods:

**Built-in functions**:
- `map(func, iterable)` - Transform sequence
- `filter(func, iterable)` - Filter sequence
- `zip(*iterables)` - Combine sequences
- `enumerate(iterable)` - Add indices
- `sorted(iterable)` - Sort sequence
- `reversed(iterable)` - Reverse sequence

**list methods**:
- `list.append(item)` - Modify list
- `list.extend(items)` - Extend list
- `list.pop()` - Remove and return
- List comprehensions (if feasible)

**dict methods**:
- `dict.get(key)` - Get value
- `dict.items()` - Key-value pairs
- `dict.keys()` - Keys
- `dict.values()` - Values
- Dict comprehensions (if feasible)

**typing module**:
- `Optional[T]` - Union with None
- `Union[A, B]` - Type unions
- `List[T]` - Generic list
- `Dict[K, V]` - Generic dict

**Iterator protocol**:
- `__iter__()` - Return iterator
- `__next__()` - Get next item

## Stub File Location

Create: `type_stubs/python.json`

## Stub Definitions

### Built-in Functions

```json
{
  "language": "python",
  "stubs": {
    "map": {
      "infer_rules": {
        "callback_param:0": {
          "from": "call_argument:1",
          "transform": "iterable_element_type"
        },
        "return": {
          "from": "callback_return",
          "transform": "iterator_of"
        }
      },
      "note": "map(func, iterable) returns an iterator of func's return type"
    },
    "filter": {
      "infer_rules": {
        "callback_param:0": {
          "from": "call_argument:1",
          "transform": "iterable_element_type"
        },
        "return": {
          "from": "call_argument:1",
          "transform": "iterator_of_same_type"
        }
      }
    },
    "zip": {
      "infer_rules": {
        "return": {
          "from": "call_arguments:*",
          "transform": "zip_result_type"
        }
      },
      "note": "zip(*iterables) returns iterator of tuples"
    },
    "enumerate": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "enumerate_result_type"
        }
      },
      "note": "enumerate(iterable) returns Iterator[Tuple[int, T]]"
    },
    "sorted": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "list_of_same_type"
        }
      }
    },
    "reversed": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "reversed_iterator"
        }
      }
    }
  }
}
```

### list Methods

```json
{
  "list.append": {
    "infer_rules": {
      "return": {
        "from": "literal",
        "value": "None"
      }
    }
  },
  "list.extend": {
    "infer_rules": {
      "return": {
        "from": "literal",
        "value": "None"
      }
    }
  },
  "list.pop": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "list_element_type"
      }
    }
  }
}
```

### dict Methods

```json
{
  "dict.get": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "dict_value_type"
      }
    }
  },
  "dict.items": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "dict_items_type"
      }
    },
    "note": "Returns ItemsView[tuple[K, V]]"
  },
  "dict.keys": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "dict_keys_type"
      }
    }
  },
  "dict.values": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "dict_values_type"
      }
    }
  }
}
```

### typing Module

```json
{
  "Optional": {
    "infer_rules": {
      "return": {
        "from": "call_argument:0",
        "transform": "union_with_none"
      }
    },
    "note": "Optional[T] is equivalent to Union[T, None]"
  },
  "Union": {
    "infer_rules": {
      "return": {
        "from": "call_arguments:*",
        "transform": "union_type"
        }
    }
  },
  "List": {
    "infer_rules": {
      "return": {
        "from": "call_argument:0",
        "transform": "list_of"
      }
    }
  },
  "Dict": {
    "infer_rules": {
      "return": {
        "from": "call_arguments:0,1",
        "transform": "dict_of"
      }
    }
  }
}
```

## New Transform Operations Needed

Add to `rule_evaluator.ts`:

```typescript
case "iterable_element_type":
  // list[T], Iterator[T], etc. → T
  return extract_generic_argument(type, 0);

case "iterator_of":
  // T → Iterator[T]
  return `Iterator[${type}]`;

case "list_of_same_type":
  // Iterator[T] → list[T]
  const elem = extract_generic_argument(type, 0);
  return elem ? `list[${elem}]` : "list";

case "enumerate_result_type":
  // list[T] → Iterator[tuple[int, T]]
  const inner = extract_generic_argument(type, 0);
  return `Iterator[tuple[int, ${inner || 'Any'}]]`;

case "dict_value_type":
  // dict[K, V] → V
  return extract_generic_argument(type, 1);

case "dict_items_type":
  // dict[K, V] → ItemsView[tuple[K, V]]
  const key = extract_generic_argument(type, 0);
  const val = extract_generic_argument(type, 1);
  return `ItemsView[tuple[${key}, ${val}]]`;

case "union_with_none":
  // T → Union[T, None] or T | None
  return `${type} | None`;
```

## Testing

### Test Cases

```python
# Test 1: map() with list
users: list[User] = get_users()
names = map(lambda u: u.get_name(), users)
# Expected: u type = User
# Expected: u.get_name() resolves

# Test 2: filter() with list
active_users = filter(lambda u: u.is_active(), users)
# Expected: u type = User
# Expected: u.is_active() resolves

# Test 3: dict.get()
user_cache: dict[str, User] = {}
user = user_cache.get("123")
# Expected: user type = User (or User | None)
# Expected: user.get_name() resolves

# Test 4: dict.items()
for user_id, user in user_cache.items():
    user.get_name()
# Expected: user type = User

# Test 5: enumerate()
for idx, user in enumerate(users):
    user.get_name()
# Expected: user type = User
# Expected: idx type = int

# Test 6: Optional type annotation
def get_user(id: str) -> Optional[User]:
    ...

user = get_user("123")
if user:
    user.get_name()  # Should resolve
```

## Python-Specific Challenges

### 1. Comprehensions

List/dict/set comprehensions are syntax, not method calls:

```python
names = [u.get_name() for u in users]
```

This may require special handling in the semantic index, not stubs.

**Decision**: Document as out-of-scope for now, handle in future task if needed.

### 2. Dynamic Typing

Python is dynamically typed, so many patterns don't have type hints:

```python
# No type hints - can't infer
users = get_users()
names = [u.get_name() for u in users]
```

**Decision**: Only handle cases with type hints. Heuristic fallback (task-154) will handle the rest.

### 3. Protocol Types

Python 3.8+ has Protocol types (structural typing):

```python
class Drawable(Protocol):
    def draw(self) -> None: ...

def render(obj: Drawable):
    obj.draw()  # Should resolve to any class with draw()
```

**Decision**: Out of scope for stubs. May need special handling in type resolution.

## Files to Create

1. `type_stubs/python.json` - Python built-in stubs
2. `packages/core/src/resolve_references/type_stubs/python_stubs.test.ts` - Tests

## Files to Modify

1. `packages/core/src/resolve_references/type_stubs/rule_evaluator.ts`
   - Add Python-specific transforms

## Acceptance Criteria

- [ ] Built-in functions stubbed (map, filter, zip, enumerate, sorted, reversed)
- [ ] list methods stubbed (append, extend, pop)
- [ ] dict methods stubbed (get, items, keys, values)
- [ ] typing module stubbed (Optional, Union, List, Dict)
- [ ] New transform operations implemented
- [ ] All test cases pass
- [ ] Documentation explains Python-specific behaviors

## Priority Order

1. **map/filter** - Very common in functional Python
2. **dict.get/items** - Common dict operations
3. **enumerate** - Common iteration pattern
4. **Optional** - Type hint usage
5. Others as time permits

## Success Criteria

Common Python patterns work:

```python
users: list[User] = get_users()
names = map(lambda u: u.get_name(), users)
# u.get_name() should resolve to User.get_name()
```

## Notes

- Python's type system is gradually typed - many codebases have partial hints
- Focus on typed code first (where stubs help most)
- Untyped code will fall back to heuristics (task-154)
- Consider adding examples for both Python 3.9- (`List[T]`) and Python 3.10+ (`list[T]`) syntax
