# Task 155.6: Rust Standard Library Trait Stubs

**Parent**: task-155
**Dependencies**: task-155.1, task-155.2
**Status**: TODO
**Priority**: High
**Estimated Effort**: 1 day

## Goal

Create type stubs for Rust standard library traits and common patterns that describe how types flow through them.

## Scope

Cover commonly used Rust std library patterns:

**Iterator trait**:
- `Iterator::map(f)` - Transform elements
- `Iterator::filter(f)` - Filter elements
- `Iterator::fold(init, f)` - Reduce/accumulate
- `Iterator::collect()` - Collect into collection
- `Iterator::find(f)` - Find element
- `Iterator::filter_map(f)` - Combined filter + map

**Option<T>**:
- `Option::map(f)` - Transform Some value
- `Option::and_then(f)` - Flatmap
- `Option::unwrap_or(default)` - Unwrap with default
- `Option::unwrap_or_else(f)` - Unwrap with function
- `Option::ok_or(err)` - Convert to Result

**Result<T, E>**:
- `Result::map(f)` - Transform Ok value
- `Result::and_then(f)` - Flatmap
- `Result::unwrap_or(default)` - Unwrap with default
- `Result::ok()` - Convert to Option

**Vec<T>**:
- `Vec::iter()` - Borrow iterator
- `Vec::iter_mut()` - Mutable iterator
- `Vec::into_iter()` - Consuming iterator
- `Vec::push(item)` - Add element
- `Vec::pop()` - Remove element

## Stub File Location

Create: `type_stubs/rust.json`

## Stub Definitions

### Iterator Trait Methods

```json
{
  "language": "rust",
  "stubs": {
    "Iterator::map": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "iterator_item_type"
        },
        "return": {
          "from": "callback_return",
          "transform": "iterator_of"
        }
      },
      "note": "Iterator<Item=T>.map(|x| f(x)) returns Iterator<Item=F>"
    },
    "Iterator::filter": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "iterator_item_type_ref"
        },
        "return": {
          "from": "receiver",
          "transform": "identity"
        }
      },
      "note": "filter takes &Item, returns same iterator type"
    },
    "Iterator::fold": {
      "infer_rules": {
        "callback_param:0": {
          "from": "call_argument:0",
          "transform": "identity"
        },
        "callback_param:1": {
          "from": "receiver",
          "transform": "iterator_item_type"
        },
        "return": {
          "from": "call_argument:0 | callback_return"
        }
      },
      "note": "fold(init, |acc, x| f(acc, x)) returns type of init/f"
    },
    "Iterator::collect": {
      "infer_rules": {
        "return": {
          "from": "turbofish | type_annotation",
          "transform": "identity"
        }
      },
      "note": "collect() return type from turbofish ::<Vec<_>> or type annotation"
    },
    "Iterator::find": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "iterator_item_type_ref"
        },
        "return": {
          "from": "receiver",
          "transform": "option_of_item_type"
        }
      }
    },
    "Iterator::filter_map": {
      "infer_rules": {
        "callback_param:0": {
          "from": "receiver",
          "transform": "iterator_item_type"
        },
        "return": {
          "from": "callback_return",
          "transform": "iterator_of_option_inner"
        }
      },
      "note": "filter_map(|x| Option<Y>) returns Iterator<Item=Y>"
    }
  }
}
```

### Option<T> Methods

```json
{
  "Option::map": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "option_inner"
      },
      "return": {
        "from": "callback_return",
        "transform": "option_of"
      }
    },
    "note": "Option<T>.map(|x| f(x)) returns Option<F>"
  },
  "Option::and_then": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "option_inner"
      },
      "return": {
        "from": "callback_return",
        "transform": "identity"
      }
    },
    "note": "Option<T>.and_then(|x| Option<U>) returns Option<U>"
  },
  "Option::unwrap_or": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "option_inner"
      }
    }
  },
  "Option::unwrap_or_else": {
    "infer_rules": {
      "return": {
        "from": "receiver | callback_return",
        "transform": "option_inner"
      }
    }
  },
  "Option::ok_or": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "option_to_result"
      }
    },
    "note": "Option<T>.ok_or(E) returns Result<T, E>"
  }
}
```

### Result<T, E> Methods

```json
{
  "Result::map": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "result_ok_type"
      },
      "return": {
        "from": "callback_return",
        "transform": "result_of"
      }
    },
    "note": "Result<T, E>.map(|x| f(x)) returns Result<F, E>"
  },
  "Result::and_then": {
    "infer_rules": {
      "callback_param:0": {
        "from": "receiver",
        "transform": "result_ok_type"
      },
      "return": {
        "from": "callback_return",
        "transform": "identity"
      }
    }
  },
  "Result::unwrap_or": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "result_ok_type"
      }
    }
  },
  "Result::ok": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "result_to_option"
      }
    },
    "note": "Result<T, E>.ok() returns Option<T>"
  }
}
```

### Vec<T> Methods

```json
{
  "Vec::iter": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "vec_to_iter_ref"
      }
    },
    "note": "Vec<T>.iter() returns Iter<'_, T> (iterator of &T)"
  },
  "Vec::iter_mut": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "vec_to_iter_mut"
      }
    },
    "note": "Vec<T>.iter_mut() returns IterMut<'_, T> (iterator of &mut T)"
  },
  "Vec::into_iter": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "vec_to_into_iter"
      }
    },
    "note": "Vec<T>.into_iter() returns IntoIter<T> (iterator of T)"
  },
  "Vec::push": {
    "infer_rules": {
      "return": {
        "from": "literal",
        "value": "()"
      }
    }
  },
  "Vec::pop": {
    "infer_rules": {
      "return": {
        "from": "receiver",
        "transform": "option_of_vec_item"
      }
    },
    "note": "Vec<T>.pop() returns Option<T>"
  }
}
```

## New Transform Operations Needed

Add to `rule_evaluator.ts`:

```typescript
// Iterator transforms
case "iterator_item_type":
  // Iterator<Item=T> → T, or Vec<T> → T
  if (type.includes("Iterator<Item=")) {
    return extract_iterator_item(type);
  }
  return extract_generic_argument(type, 0);

case "iterator_item_type_ref":
  // Iterator<Item=T> → &T
  const item = extract_iterator_item(type);
  return item ? `&${item}` : undefined;

case "iterator_of":
  // T → Iterator<Item=T>
  return `Iterator<Item=${type}>`;

case "option_of_item_type":
  // Iterator<Item=T> → Option<T>
  const item = extract_iterator_item(type);
  return item ? `Option<${item}>` : undefined;

// Option transforms (already have option_inner from earlier)
case "option_of":
  // T → Option<T>
  return `Option<${type}>`;

case "option_to_result":
  // Option<T> + error arg → Result<T, E>
  const t = extract_generic_argument(type, 0);
  const e = get_argument_type(call, 0, context); // Error type from arg
  return `Result<${t}, ${e}>`;

// Result transforms (already have result_ok from earlier)
case "result_of":
  // T → Result<T, E> (preserve E from receiver)
  const err = extract_generic_argument(receiver_type, 1);
  return `Result<${type}, ${err}>`;

case "result_to_option":
  // Result<T, E> → Option<T>
  const ok = extract_generic_argument(type, 0);
  return `Option<${ok}>`;

// Vec transforms
case "vec_to_iter_ref":
  // Vec<T> → Iter<'_, T>
  const elem = extract_generic_argument(type, 0);
  return `Iter<'_, ${elem}>`;

case "vec_to_into_iter":
  // Vec<T> → IntoIter<T>
  const elem = extract_generic_argument(type, 0);
  return `IntoIter<${elem}>`;

case "option_of_vec_item":
  // Vec<T> → Option<T>
  const elem = extract_generic_argument(type, 0);
  return `Option<${elem}>`;

// Helper function
function extract_iterator_item(type: SymbolName): SymbolName | undefined {
  const match = type.match(/Iterator<Item=([^>]+)>/);
  return match ? match[1] as SymbolName : undefined;
}
```

## Testing

### Test Cases

```rust
// Test 1: Iterator::map
let users: Vec<User> = get_users();
let names = users.iter().map(|u| u.get_name());
// Expected: u type = &User
// Expected: u.get_name() resolves

// Test 2: Iterator::filter
let active = users.iter().filter(|u| u.is_active());
// Expected: u type = &User
// Expected: u.is_active() resolves

// Test 3: Iterator::fold (like reduce)
let count = users.iter().fold(0, |acc, u| {
    acc + u.get_score()
});
// Expected: acc type = i32 (from init value)
// Expected: u type = &User
// Expected: u.get_score() resolves

// Test 4: Option::map
let user: Option<User> = get_user();
let name = user.map(|u| u.get_name());
// Expected: u type = User
// Expected: u.get_name() resolves

// Test 5: Result::map
let result: Result<User, Error> = try_get_user();
let name = result.map(|u| u.get_name());
// Expected: u type = User
// Expected: u.get_name() resolves

// Test 6: Vec::iter chain
let names: Vec<String> = users
    .iter()
    .filter(|u| u.is_active())
    .map(|u| u.get_name())
    .collect();
// Expected: All intermediate types correct
```

## Rust-Specific Challenges

### 1. Ownership and References

Rust's ownership affects type flow:

```rust
let users: Vec<User> = ...;
users.iter()      // Iterator<Item=&User>
users.iter_mut()  // Iterator<Item=&mut User>
users.into_iter() // Iterator<Item=User>
```

**Decision**: Track reference types (`&T`, `&mut T`) in transforms.

### 2. Turbofish Syntax

Generic parameters can be explicit:

```rust
let result = iterator.collect::<Vec<_>>();
```

**Decision**: Try to extract from turbofish, fallback to type annotation.

### 3. Trait Methods vs Inherent Methods

Same method name can exist on type and trait:

```rust
impl Iterator for MyIter { ... }  // Trait method
impl MyIter { fn map(...) }       // Inherent method
```

**Decision**: Match by trait name `Iterator::map`, not just `map`.

### 4. Associated Types

Iterator uses associated type `Item`:

```rust
trait Iterator {
    type Item;
    fn map<F>(...) -> Map<Self, F>;
}
```

**Decision**: Handle `Iterator<Item=T>` syntax specially.

## Files to Create

1. `type_stubs/rust.json` - Rust std library stubs
2. `packages/core/src/resolve_references/type_stubs/rust_stubs.test.ts` - Tests

## Files to Modify

1. `packages/core/src/resolve_references/type_stubs/rule_evaluator.ts`
   - Add Rust-specific transforms
   - Add helper for extracting `Iterator<Item=T>`

## Acceptance Criteria

- [ ] Iterator trait methods stubbed (map, filter, fold, collect, find, filter_map)
- [ ] Option methods stubbed (map, and_then, unwrap_or, unwrap_or_else, ok_or)
- [ ] Result methods stubbed (map, and_then, unwrap_or, ok)
- [ ] Vec methods stubbed (iter, iter_mut, into_iter, push, pop)
- [ ] New transform operations implemented
- [ ] Reference types tracked correctly (&T, &mut T)
- [ ] All test cases pass
- [ ] Documentation explains Rust-specific behaviors

## Priority Order

1. **Iterator::map/filter** - Most common pattern
2. **Option::map/and_then** - Error handling patterns
3. **Result::map** - Error handling patterns
4. **Vec::iter** - Collection iteration
5. Others as time permits

## Success Criteria

Common Rust patterns work:

```rust
let users: Vec<User> = get_users();
let names = users.iter().map(|u| u.get_name());
// u.get_name() should resolve to User::get_name()
```

## Notes

- Rust's type system is very precise - our stubs are approximations
- Focus on common patterns (iterator chains, Option/Result handling)
- Reference tracking is important but complex - do best effort
- Consider adding lifetime elision rules if needed (future)
