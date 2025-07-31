# @ariadnejs/mcp

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
