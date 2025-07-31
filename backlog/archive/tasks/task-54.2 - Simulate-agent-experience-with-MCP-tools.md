---
id: task-54.2
title: Simulate agent experience with MCP tools
status: Done
assignee:
  - '@claude'
created_date: '2025-07-30'
updated_date: '2025-07-31'
labels: []
dependencies: []
parent_task_id: task-54
---

## Description

Create realistic simulations of how different coding agents would experience our MCP tools. Generate accurate prompts that show the full context an LLM would see, including system prompts, tool definitions, and typical user requests.

## Acceptance Criteria

- [ ] Prompt templates created for major agents (Aider Continue OpenDevin AutoGen)
- [ ] Tool definition schemas in MCP format documented
- [ ] Example agent workflows with context documented
- [ ] Common failure scenarios identified
- [ ] Agent-specific formatting requirements captured

## Implementation Notes

Created comprehensive agent experience simulations in agent-experience-prompts.yaml

Key findings:

1. Each agent has unique integration patterns - Aider uses SEARCH/REPLACE, Continue has IDE context, AutoGen uses functions, OpenDevin has multi-step planning
2. MCP tools need to present themselves differently to each agent while providing consistent functionality
3. Context-oriented tools (get_symbol_context, find_related_code) are much more natural for agents than position-based tools
4. Tool invocation syntax varies significantly - XML tags, function calls, JSON objects
5. Agents benefit most from MCP when gathering context before making changes

The simulations demonstrate how our proposed context-oriented tools would integrate with each agent's workflow, providing rich symbol information without requiring file positions.

Successfully created comprehensive agent experience simulations. All acceptance criteria completed through agent-experience-prompts.yaml file which documents tool definitions, agent-specific workflows, formatting requirements, and integration patterns for major coding agents (Aider, Continue, OpenDevin, AutoGen).
