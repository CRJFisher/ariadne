### How `tree-sitter` is used to parse individual files:

This repository uses the `tree-sitter` library in its Rust backend (`server/bleep`) to parse source code into an Abstract Syntax Tree (AST). Here's a breakdown of the process:

1.  **Language Configuration**:
    *   The core of the language support is in `server/bleep/src/intelligence/language.rs`.
    *   A `TSLanguageConfig` struct is defined for each supported language. This struct contains:
        *   The language name(s) and file extension(s).
        *   A function pointer to the `tree-sitter` grammar for that language (e.g., `tree_sitter_rust::language`).
        *   `tree-sitter` queries for extracting information like symbols (`scope_query`) and hoverable regions (`hoverable_query`).
    *   All these configurations are stored in a static slice called `ALL_LANGUAGES`.

2.  **File Parsing**:
    *   The main parsing logic resides in `server/bleep/src/intelligence.rs`.
    *   The `TreeSitterFile::try_build` function is the entry point for parsing a file.
    *   It takes the file content (as bytes) and a language ID string as input.

3.  **The Parsing Steps**:
    *   First, it checks if the file exceeds a size limit of 500kb.
    *   It looks up the appropriate `TSLanguageConfig` using the language ID.
    *   A new `tree-sitter::Parser` instance is created.
    *   The crucial step is `parser.set_language((language.grammar)())`, which loads the correct `tree-sitter` grammar for the file's language.
    *   A 1-second timeout is set for parsing to prevent long-running operations.
    *   The `parser.parse()` method is called, which takes the source code and generates the `tree-sitter` tree.
    *   If successful, a `TreeSitterFile` struct is created, which holds the source code, the generated tree, and the language configuration.

4.  **Post-Parsing Analysis**:
    *   Once the file is parsed into a `TreeSitterFile`, other methods are used to analyze the AST.
    *   `scope_graph()` uses the `scope_query` from the language configuration to run a `tree-sitter` query on the AST. This extracts symbols and their scopes to build a `ScopeGraph`, which is likely used for code intelligence features like "go to definition".
    *   `hoverable_ranges()` uses the `hoverable_query` to find all the code ranges that should trigger a hover popup in the user interface.

In short, the system is designed to be extensible. To add a new language, one would need to add its `tree-sitter` grammar to the `Cargo.toml`, and then create a new `TSLanguageConfig` instance for it in `server/bleep/src/intelligence/language.rs` with the relevant queries.

---

### Finding References Across Files: The `ScopeGraph`

The next logical question is: how does the system find references to a symbol across multiple files? The `TreeSitterFile` provides a detailed view of a single file, but the cross-file analysis is handled by the `ScopeGraph`.

1.  **The `ScopeGraph` Structure**:
    *   The logic for this is in `server/bleep/src/intelligence/scope_resolution.rs`.
    *   For each parsed file, a `ScopeGraph` is created. This is a directed graph containing nodes that represent code constructs.
    *   **Nodes (`NodeKind`)**: There are four types of nodes:
        *   `Scope`: A lexical scope (e.g., a function body or a block).
        *   `Def`: The definition of a symbol (e.g., a variable or function declaration).
        *   `Ref`: A reference to a symbol (i.e., its usage).
        *   `Import`: An import statement.
    *   **Edges (`EdgeKind`)**: These nodes are connected by edges that define their relationships, such as `DefToScope` (linking a definition to its scope) and, most importantly, `RefToDef` (linking a reference to its definition).

2.  **Building the Graph**:
    *   The `scope_graph()` function builds this graph by executing the `scope_query` from the language configuration against the file's AST.
    *   This query uses special capture names (e.g., `@definition.function`, `@reference.variable`, `@scope`) to identify the different parts of the code.
    *   When a `@reference` is found, the system walks up the scope hierarchy within the file to find a matching `@definition` or `@import` with the same name, and creates the corresponding `RefToDef` or `RefToImport` edge.

3.  **Cross-File Analysis**:
    *   Crucially, a single `ScopeGraph` **only contains information about one file**. It does not, by itself, resolve references across file boundaries.
    *   The cross-file reference resolution is achieved at a higher level of the application by combining the information from multiple `ScopeGraph`s:
        1.  **Parse All Files**: First, the system parses all relevant files in the project, generating a `ScopeGraph` for each one.
        2.  **Identify Exports**: When looking for references of a symbol, it first finds its `Def` node in its home file. The `scope_query` for the language can be designed to identify if this definition is exported (e.g. with `pub` in Rust or `export` in JavaScript).
        3.  **Resolve Imports**: The system then scans the `ScopeGraph` of every other file, looking for `Import` nodes that point to the original symbol's file and name.
        4.  **Aggregate References**: By finding an `Import` node in another file, the system can then follow the `RefToImport` edges from that node to discover all the places where the imported symbol is used in that file.
    *   By repeating this process across all `ScopeGraph`s, the application can build a complete picture of all references to a symbol throughout the entire codebase.

In essence, the `ScopeGraph` is a powerful per-file analysis tool, and the overall system stitches these individual analyses together to provide project-wide code intelligence. 