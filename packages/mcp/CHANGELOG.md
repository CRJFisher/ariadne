# @ariadnejs/mcp

## 0.3.0

### Minor Changes

- 817beb4: Declare the supported Node.js range

  - `@ariadnejs/core`, `@ariadnejs/types` and `@ariadnejs/mcp` require Node.js 22.13.0 or later; package managers warn when installed on an older Node.

- 817beb4: Report true entry points by default, and put the suppressed bucket behind a flag.

  `list_entrypoints` sources its output from
  `Project.get_classified_entry_points()`, so the default listing an agent reads
  holds true entry points only. Framework-invoked routes, Python dunder protocol
  methods, dynamically dispatched callables, indirect-only calls and test-only
  code no longer appear as functions nothing calls.

  Start the server with `--show-suppressed` (or `ARIADNE_SHOW_SUPPRESSED=1`) to
  append a clearly-delimited "Suppressed (known false positives)" section, each
  entry tagged with the `[group_id: detail]` that matched it. The flag is
  server-level rather than a per-call parameter, so a triage workflow enables it
  once in `.mcp.json` while everyday agents keep the clean default;
  `--no-show-suppressed` overrides the environment variable.

  The `ariadne-mcp` binary and the `start_server` export keep their names. The
  tool set is unchanged: `list_entrypoints` and `show_call_graph_neighborhood`.

### Patch Changes

- 817beb4: Refuse a path outside the loaded project instead of answering about a different codebase.

  The server loads one project root at startup. A `files` or `folders` argument, or
  an absolute `symbol_ref` path, that lies outside that root used to produce an
  answer about another tree, or a "Could not find callable" that did not say why.
  It now returns an error response naming the offending path and the loaded root.
  An empty-string entry in `files` or `folders` is rejected the same way.

- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
  - @ariadnejs/core@1.0.0
  - @ariadnejs/types@1.0.0

## 0.2.0

### Minor Changes

- 33ff291: New tools, analytics, and reliability improvements

  - Add show_call_graph_neighborhood tool for exploring call graphs
  - Rename list_functions to list_entrypoints with file/folder filtering
  - Add ProjectManager with file watching and symlink cycle handling
  - Add SQLite-backed analytics for tool usage tracking
  - Add structured logger with debug file logging
  - Fix debounced file watcher async callback handling
  - Filter false callback self-cycles in call graph display

### Patch Changes

- Updated dependencies [33ff291]
  - @ariadnejs/core@0.8.0
  - @ariadnejs/types@0.8.0

## 0.1.5

### Patch Changes

- 8a43be7: feat: Namespace imports support and comprehensive fixes

  **@ariadnejs/core**

  - ✅ Added namespace import support for JavaScript/TypeScript
  - ✅ 502 tests passing (96% pass rate)
  - ✅ Started migration to new feature-based folder structure
  - ✅ Fixed cross-file call tracking for all languages
  - ✅ Improved import/export resolution

  **@ariadnejs/mcp**

  - ✅ Fixed compatibility with core v0.6.0 API
  - ✅ All 13 tests now passing
  - ✅ Improved symbol context extraction
  - ✅ Added robust fallback mechanisms for inheritance detection

- Updated dependencies [8a43be7]
  - @ariadnejs/core@0.7.0

## 0.1.4

### Patch Changes

- Updated dependencies
  - @ariadnejs/core@0.6.0

## 0.1.3

### Patch Changes

- 7e494f4: Improve documentation and fix server regression

  - Moved detailed API documentation from main README to core package README
  - Simplified main README to be a high-level project overview with links to packages
  - Enhanced core README with comprehensive API documentation, method descriptions, and usage examples
  - Updated MCP README to only document the implemented get_symbol_context tool
  - Fixed server.ts to use VERSION import instead of hardcoded 0.5.12
  - Fixed regression where CLI binary had old position-based tools instead of new context-oriented tools

- Updated dependencies [7e494f4]
  - @ariadnejs/core@0.5.18

## 0.1.2

### Patch Changes

- 9f35dbd: Complete get_symbol_context MCP tool with full inheritance support

  - **@ariadnejs/core**: Fixed interface inheritance extraction for TypeScript interfaces that extend other interfaces
  - **@ariadnejs/core**: Extended inheritance APIs to support interface hierarchies in get_inheritance_chain() and find_subclasses()
  - **@ariadnejs/mcp**: Updated get_symbol_context to use enclosing_range for full function body extraction
  - **@ariadnejs/mcp**: Added class/interface inheritance relationships to symbol context using new core APIs
  - **@ariadnejs/mcp**: Added support for Rust struct and trait analysis
  - **@ariadnejs/mcp**: Added comprehensive tests for function body extraction and inheritance relationships

  Completes task-54.1 with all acceptance criteria met. Performance remains under 200ms.

- Updated dependencies [9f35dbd]
  - @ariadnejs/core@0.5.17

## 0.1.1

### Patch Changes

- Updated dependencies [d244119]
  - @ariadnejs/core@0.5.16

## 0.1.0

### Minor Changes

- 86c314f: feat: add @ariadnejs/mcp package for Model Context Protocol support

  - New package @ariadnejs/mcp provides an MCP server that exposes Ariadne's code intelligence capabilities
  - Implements go_to_definition and find_references tools via MCP protocol
  - Supports Claude Desktop, VS Code, Cursor and other MCP-compatible hosts
  - Includes comprehensive setup documentation
