# Tree-sitter Deep Dive: From Single File to Project-Wide References

This document provides a detailed, code-level analysis of how this repository uses `tree-sitter` to understand code, starting with how it parses a single file and culminating in how it resolves symbol references across an entire project.

---

## Part 1: The Per-File `ScopeGraph`

The foundation of all code intelligence in this system is the `ScopeGraph`, a detailed map of all the symbols and their relationships within a *single file*. This graph is built in `server/bleep/src/intelligence/scope_resolution.rs`.

### The `scope_res_generic` Function

This is the engine room. The function `scope_res_generic` takes the `tree-sitter` query for a language, the parsed AST (`root_node`), and the source code, and uses them to construct the `ScopeGraph`.

The process begins by creating an empty `ScopeGraph` and running the `tree-sitter` query against the AST:

*   **Code Location**: `server/bleep/src/intelligence/scope_resolution.rs`

```rust
// A new graph is created with a root scope that spans the entire file.
let mut scope_graph = ScopeGraph::new(root_node.range().into(), lang_id);

// A QueryCursor is used to find all matches for the given query in the AST.
let mut query_cursor = QueryCursor::new();
let query_matches = query_cursor.matches(query, root_node, src);
```

The function then iterates through every match found by the query. The magic here is in the **capture names** used in the language-specific `.scm` files (e.g., `(function_declaration name: (@definition.function))`). The code checks the name of the capture to decide what to do.

### Processing Definitions

When the query matches a definition (e.g., a capture named `@definition.function`, `@definition.class`, etc.), the code extracts its properties.

A key concept here is `Scoping`, which can be `Local`, `Hoisted`, or `Global`. This is determined by a property set on the query capture, like `(#set! scoping "hoisted")`.

*   **Code Location**: `server/bleep/src/intelligence/scope_resolution.rs`

```rust
// The capture name is split, e.g., "definition.function.hoisted"
let mut parts = capture.pattern().splitn(3, '.');
let kind = parts.next().unwrap(); // "definition"
let symbol = parts.next();      // "function"
let scoping = parts
    .next()
    .and_then(|s| s.parse::<Scoping>().ok())
    .unwrap_or(Scoping::Local); // "hoisted" -> Scoping::Hoisted

// ... a LocalDef is created ...

// Based on the scoping, the appropriate insert method is called.
match scoping {
    Scoping::Local => scope_graph.insert_local_def(def),
    Scoping::Hoisted => scope_graph.insert_hoisted_def(def),
    Scoping::Global => scope_graph.insert_global_def(def),
}
```

The `insert_local_def` function finds the innermost scope that contains the definition and adds a `Def` node to the graph, connecting it to its containing `Scope` node with a `DefToScope` edge.

### Processing Scopes

When the query matches a `@scope` capture, the process is simpler. It creates a `LocalScope` and calls `insert_local_scope`. This function finds the correct parent scope based on text ranges and adds the new `Scope` node to the graph, connecting it with a `ScopeToScope` edge. This builds the hierarchy of nested scopes.

### Processing References

This is the most complex part of the per-file analysis. When a `@reference` capture is found, the system must find what it refers to.

*   **Code Location**: `server/bleep/src/intelligence/scope_resolution.rs`, inside the `ScopeGraph::insert_ref` method.

The `insert_ref` function is called for each reference. It performs the classic lexical scope resolution algorithm:

1.  It finds the innermost scope containing the reference.
2.  It then begins to walk up the scope chain, from the current scope to its parent, and so on, all the way to the file's root scope.
3.  In each scope it visits, it looks for any `Def` or `Import` nodes that have the same name as the reference.

```rust
// In `ScopeGraph::insert_ref`:
// It finds the starting scope for the reference.
if let Some(local_scope_idx) = self.scope_by_range(new.range, self.root_idx) {
    // It walks up the scope chain using a helper called `ScopeStack`.
    for scope in self.scope_stack(local_scope_idx) {
        // In each scope, it looks for definitions with a matching name.
        for local_def in self
            .graph
            .edges_directed(scope, Direction::Incoming)
            // ... filter for DefToScope edges ...
        {
            if let NodeKind::Def(def) = &self.graph[local_def] {
                if new.name(src) == def.name(src) {
                    // ... further checks for namespaces ...
                    possible_defs.push(local_def);
                }
            }
        }
        // It does the same for imports...
    }
}
```

If any potential definitions or imports are found, a `Ref` node is added to the graph, and `RefToDef` or `RefToImport` edges are created to link it to all its potential definitions.

---

## Part 2: Cross-File Stitching

As established, the `ScopeGraph` is a per-file data structure. The search results indicated that the `symbol.rs` file is where these graphs are likely used to build a project-wide understanding.

*   **Code Location**: `server/bleep/src/symbol.rs`

The `Symbol` struct in this file represents a symbol found within the project. It contains a `SymbolLocations` enum, which can be `TreeSitter(ScopeGraph)`.

The crucial part is that the higher-level application logic (which is not in `scope_resolution.rs`) is responsible for managing a collection of these `ScopeGraph`s, likely one for every parsed file in the project, probably in some form of cache or database.

The cross-file resolution process, therefore, works as follows:

1.  **A User Action**: A user triggers an action, like "Find References" on a symbol in `file_a.rs`.
2.  **Initial Symbol Lookup**: The system gets the `ScopeGraph` for `file_a.rs`. It finds the node corresponding to the user's cursor. Let's say it's a `Def` node for a function `foo`.
3.  **Find Local References**: The system can immediately find all references *within* `file_a.rs` by looking for incoming `RefToDef` edges on the `foo` `Def` node in `file_a.rs`'s `ScopeGraph`.
4.  **Find Cross-File References**: This is the key part.
    *   The system must determine if the `foo` function is exported. This is done via the `tree-sitter` query, which can attach metadata to the `@definition` capture.
    *   The system then iterates through the `ScopeGraph` of **every other file** (`file_b.rs`, `file_c.rs`, etc.).
    *   In each of these other graphs, it looks for `Import` nodes. It checks if any of these imports correspond to the `foo` function from `file_a.rs`.
    *   If it finds a matching `Import` node in `file_b.rs`'s graph, it knows `file_b.rs` uses the symbol.
    *   It can then find all the references *within* `file_b.rs` by looking at the nodes connected to that `Import` node via `RefToImport` edges.

This process of iterating through all the other file graphs and resolving imports is what "stitches" the individual `ScopeGraph`s together into a cohesive, project-wide view, allowing for features like "Find References" and "Go to Definition" to work across the entire codebase. 