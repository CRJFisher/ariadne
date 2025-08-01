---
id: task-58
title: Add sub-agent capabilities to MCP server
status: To Do
assignee: []
created_date: '2025-08-01'
labels: []
dependencies: []
---

## Description

Enhance the MCP server with sub-agent capabilities that provide two distinct modes for codebase analysis. The first mode constructs high-level modules from function summaries and call graphs, generating minimal code flow charts. The second mode acts as a knowledge agent that synthesizes documentation and code modules into a hierarchical knowledge tree, starting from project intentions and flowing down to implementation details.

This is quite involved and so might warrant being split into a separate package. We could then make the main MCP server contain add-ons for extra capabilities.

## Acceptance Criteria

- [ ] Module construction agent can analyze function summaries and call graphs
- [ ] Module agent generates higher-level call graph descriptions as modules
- [ ] Module agent produces minimal code flow charts showing key control flow
- [ ] Knowledge agent synthesizes documentation and code module information
- [ ] Knowledge agent constructs hierarchical knowledge tree with project intentions at root
- [ ] Both agents integrate seamlessly with existing MCP server architecture
- [ ] API endpoints provided for accessing both agent modes
