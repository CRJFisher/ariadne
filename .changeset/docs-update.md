---
"@ariadnejs/mcp": patch
"@ariadnejs/core": patch
---

Improve documentation and fix server regression

- Moved detailed API documentation from main README to core package README
- Simplified main README to be a high-level project overview with links to packages
- Enhanced core README with comprehensive API documentation, method descriptions, and usage examples
- Updated MCP README to only document the implemented get_symbol_context tool
- Fixed server.ts to use VERSION import instead of hardcoded 0.5.12
- Fixed regression where CLI binary had old position-based tools instead of new context-oriented tools