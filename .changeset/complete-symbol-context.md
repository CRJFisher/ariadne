---
"@ariadnejs/core": patch
"@ariadnejs/mcp": patch
---

Complete get_symbol_context MCP tool with full inheritance support

- **@ariadnejs/core**: Fixed interface inheritance extraction for TypeScript interfaces that extend other interfaces
- **@ariadnejs/core**: Extended inheritance APIs to support interface hierarchies in get_inheritance_chain() and find_subclasses()
- **@ariadnejs/mcp**: Updated get_symbol_context to use enclosing_range for full function body extraction
- **@ariadnejs/mcp**: Added class/interface inheritance relationships to symbol context using new core APIs
- **@ariadnejs/mcp**: Added support for Rust struct and trait analysis
- **@ariadnejs/mcp**: Added comprehensive tests for function body extraction and inheritance relationships

Completes task-54.1 with all acceptance criteria met. Performance remains under 200ms.