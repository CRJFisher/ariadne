# Understanding Scope Resolution and Tree-sitter Queries

This document explains how we use `tree-sitter` queries to analyze TypeScript code and build a `ScopeGraph`. This process is the core of our single-file code intelligence, and it all happens within the `build_scope_graph` function in `src/scope-resolution.ts`.

---

## What are Tree-sitter Queries?

`tree-sitter` allows us to find specific patterns in a source code's Abstract Syntax Tree (AST) using a special query language. These queries are written in a LISP-like syntax and are stored in `.scm` files (Scheme files).

Think of it like using a CSS selector to find a specific HTML element, but for code. Instead of selecting a `div` with a class, we're selecting a *function declaration* or an *identifier*.

Each query looks for a specific pattern of nodes in the AST. When it finds a match, it can "capture" certain parts of that match and give them a name. These named captures are the key to our whole system.

## Our Queries: `queries/typescript.scm`

This file contains the set of queries we use to analyze TypeScript code. Let's break them down.

### Definition Queries

We use these queries to find where symbols (like functions and variables) are defined.

```scheme
; Find function definitions
(function_declaration
  name: (identifier) @definition.function)

; Find variable definitions
(lexical_declaration
  (variable_declarator
    name: (identifier) @definition.variable))
```

-   **What they do:**
    -   The first query looks for a `(function_declaration)` node in the AST. Within that node, it looks for a child node named `name` which must be an `(identifier)`. It then **captures** this identifier and names the capture `@definition.function`.
    -   The second query does something similar for variables declared with `let` or `const`.
-   **Why we need them:** These queries are how we identify every single definition in a file. The named capture `@definition.function` is a signal to our code that we've found a function being defined.

### A Note on Scoping: Local vs. Hoist

You'll notice our query names are very specific, like `@hoist.definition.function` and `@local.definition.variable`. This isn't just for organization; it's fundamental to how we resolve symbols correctly, reflecting how JavaScript/TypeScript itself works.

-   **Hoisted Definitions (`@hoist.*`)**: These are for declarations that are "lifted" to the top of their scope by the JavaScript engine before code execution. This mainly applies to `function` and `class` declarations. It means you can call a function before it's physically declared in your code. Our resolution logic will know it can find these definitions anywhere within their containing scope.

-   **Local Definitions (`@local.*`)**: These are for declarations that are **not** hoisted, such as variables declared with `let` and `const`, or function parameters. They are only accessible after the line where they are declared. Our resolution logic will know it can only link a reference to a local definition if the definition appears *before* the reference.

This distinction, captured directly in our query names, is the key to accurately modeling the language's scoping rules.

### Reference Queries

This query is simpler. It's designed to find every potential reference to another symbol.

```scheme
; Find any identifier being used
(identifier) @reference
```

-   **What it does:** This query finds *every* `(identifier)` node in the AST and captures it with the name `@reference`.
-   **Why we need it:** An identifier is the most basic form of a variable, function, or class being used. By capturing all of them, we create a list of every potential reference. Later, our code will filter this list and try to resolve each reference to its correct definition. We know that not every identifier is a reference to a symbol with a definition (e.g., property names on objects), but it's a great starting point.

---

## How the Queries are Used in the Code

The magic happens in the `build_scope_graph` function in `src/scope-resolution.ts`. Here's the step-by-step process:

1.  **Load the Language Configuration:** First, the code gets the correct `LanguageConfig` object (like our `TypeScriptConfig`) which contains everything needed to process a file: the parser, the queries, and the namespaces.

2.  **Create a Query Object:** It then creates a `Query` object, giving it the language grammar (from `config.parser`) and the query string (`config.scope_query`).

    ```typescript
    // in src/scope-resolution.ts
    const query = new Query(parser.getLanguage(), config.scope_query);
    ```

3.  **Find all Matches:** The `query.matches()` method is called on the root node of the file's AST. This returns an array of all the matches found by our queries.

    ```typescript
    // in src/scope-resolution.ts
    const matches = query.matches(tree.rootNode);
    ```

4.  **Process Each Match:** The code then loops through every `match`. For each one, it looks at the name of the capture. This is where our naming convention (`@definition.function`, `@reference`) becomes critical.

    ```typescript
    // in src/scope-resolution.ts
    for (const match of matches) {
      const capture = match.captures[0];
      const capture_name = capture.name; // e.g., "definition.function" or "reference"
      const node = capture.node;         // The actual AST node that was captured

      if (capture_name.startsWith('definition')) {
        // Here, we will add logic to create a `Def` node in our ScopeGraph.
      } else if (capture_name === 'reference') {
        // Here, we will add logic to create a `Ref` node in our ScopeGraph
        // and try to resolve it.
      }
    }
    ```

### Symbol Kinds and Namespaces

You might have noticed the `namespaces` array in our `TypeScriptConfig`. This isn't just a random list; it's a critical piece of the puzzle that acts as a two-way dictionary for symbol "kinds".

-   **What it is:** The `namespaces` array defines the complete "vocabulary" of symbol kinds that our system can recognize for TypeScript (e.g., `'function'`, `'variable'`, `'class'`).

-   **Why it's clever:** Instead of storing the full string `"function"` with every function definition we find, the system uses the `namespaces` array to look up an efficient, numeric `SymbolId`. This ID is just a pair of numbers representing the index of the namespace and the index of the symbol within that namespace. Using small, numeric IDs instead of long strings internally is much faster and uses less memory.

-   **How it works with queries:** The capture names in our `.scm` file are directly linked to this. When our code sees a capture like `@definition.function`, it takes the `function` part, looks it up in the `namespaces` array to get its `SymbolId`, and then stores that ID with the definition. It provides a clean and efficient link between the patterns we find and the data we store.

By using this pattern, we create a flexible system. To support new kinds of definitions or references, we simply need to:
1.  Add a new query to the `.scm` file with a descriptive capture name.
2.  Add a corresponding `if` or `switch` case in `build_scope_graph` to handle that new capture name.

This separates the *what* (the patterns in the `.scm` file) from the *how* (the processing logic in the TypeScript code). 