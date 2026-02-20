---
"@ariadnejs/mcp": minor
---

New tools, analytics, and reliability improvements

- Add show_call_graph_neighborhood tool for exploring call graphs
- Rename list_functions to list_entrypoints with file/folder filtering
- Add ProjectManager with file watching and symlink cycle handling
- Add SQLite-backed analytics for tool usage tracking
- Add structured logger with debug file logging
- Fix debounced file watcher async callback handling
- Filter false callback self-cycles in call graph display
