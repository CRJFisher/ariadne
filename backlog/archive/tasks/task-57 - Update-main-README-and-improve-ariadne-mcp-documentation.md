---
id: task-57
title: Update main README and improve ariadne-mcp documentation
status: Done
assignee:
  - '@claude'
created_date: '2025-07-31'
labels: []
dependencies: []
---

## Description

Update the main project README to clearly point to the separate packages (@ariadnejs/core and @ariadnejs/mcp) and improve the MCP package documentation to help users understand and integrate the MCP server with their AI coding assistants.

## Acceptance Criteria

- [x] Main README updated with clear links to both packages
- [x] Main README includes brief description of each package's purpose
- [x] MCP package README expanded with installation instructions
- [x] MCP package README includes configuration examples for popular AI agents
- [x] MCP package documentation explains available tools and their usage

## Implementation Notes

Successfully updated both README files to provide clear documentation:

**Main README Updates:**
- Added prominent "Packages" section highlighting @ariadnejs/core and @ariadnejs/mcp
- Reorganized installation section to guide users to the right package
- Added MCP quick start section with example prompts
- Updated features list to include class inheritance analysis

**MCP Package README Updates:**
- Enhanced overview with key benefits section
- Expanded installation instructions for global and project-specific setups
- Added detailed configuration examples for Claude Desktop, Cursor, and Continue
- Documented all three main tools (get_symbol_context, get_call_graph, get_references) with examples
- Added comprehensive "Example Use Cases" section
- Created troubleshooting section with common issues and solutions
- Added environment variables and advanced configuration options

**SETUP.md Updates:**
- Updated to include the new context-oriented tools
- Added example prompts for each tool
- Marked get_symbol_context as recommended

All acceptance criteria have been met. The documentation now clearly guides users to choose the right package and provides comprehensive setup instructions for AI assistant integration.
