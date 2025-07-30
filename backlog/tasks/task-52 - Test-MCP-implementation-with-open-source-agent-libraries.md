---
id: task-52
title: Test MCP implementation with open-source agent libraries
status: To Do
assignee:
  - '@claude'
created_date: '2025-07-29'
updated_date: '2025-07-30'
labels: []
dependencies:
  - task-54
---

## Description

Test and analyze how LLMs use our MCP tools by creating realistic coding scenarios and evaluating their tool selection and parameter generation capabilities

## Acceptance Criteria

- [ ] Open-source agent libraries with MCP support identified
- [ ] Tool-calling flow documented from agent perspective
- [ ] Optimal tool description patterns identified
- [ ] Recommendations for improving tool descriptions documented

## Implementation Plan

1. Research typical coding agent patterns and context formats
2. Create realistic test scenarios with proper context (file path, position, code snippet)
3. Build a simple test script that directly evaluates LLM tool usage
4. Test various scenarios to identify common issues (placeholder values, wrong types)
5. Iterate on tool descriptions to improve clarity
6. Document findings and best practices

## Implementation Notes

### Initial Research Phase

Conducted comprehensive research on how major coding agents (Aider, AutoGen, OpenDevin, Continue) work and what context they provide. Created initial test implementations with mcp-agent and PocketFlow frameworks.

### Key Discovery

Through our research and testing, we discovered a fundamental incompatibility:

- **Current Ariadne MCP tools** require exact file positions (row, column)
- **Most coding agents** work with whole files or natural language queries
- **Only IDE-integrated agents** (like Continue) naturally have cursor position context

This led to the realization that our position-based navigation tools (`go_to_definition`, `find_references`) are incompatible with the majority of coding agents.

### Pivot Required

Based on this analysis, we need to:

1. **First complete task 54**: Transform Ariadne MCP from navigation to context-oriented tools
2. **Then return to this task**: Test the new context-oriented tools with agent libraries

### Next Steps

1. Complete task 54 to implement context-oriented tools
2. Return to this task to test integration with:
   - Aider (with context adapter)
   - Continue (native integration)
   - OpenDevin (with position inference)
   - AutoGen (as wrapped functions)
3. Measure success metrics defined in task 54
