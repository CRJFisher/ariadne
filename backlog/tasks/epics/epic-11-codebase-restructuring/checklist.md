# Checklist

- Language feature path splitting patterns.
  - Decide between / combine:
    - Language-specific identifiers + generic processing
    - Language needs specialised processing
- Coding
  - Move to immutable object creation
  - Remove optional fields where possible (lots are marked as optional but are actually always present)
  - Snake case module, function, variable names. Some pascal case has crept in.
- Types
  - For constructed string types (e.g. symbols etc) use 'branded' types e.g. `type Symbol = string & { __brand: 'Symbol' }` and include creator and parser functions for the type

## Points to resolve

- There are a lot of strings that are constructed in certain, specific ways. We could have type aliases for these but the type linkage seems weak. Is there some way to strengthen the typing e.g. make it a class with the necessary fields and have a methods to construct and parse them? E.g. `const namespace_key = "${call.location.file_path}:${namespace}";` happens deep in the code. It's meaning is then lost on the downstream code.
  - Use branded types
