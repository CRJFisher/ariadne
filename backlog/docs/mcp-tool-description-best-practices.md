# MCP Tool Description Best Practices

## Overview

This document outlines best practices for writing effective tool descriptions in Model Context Protocol (MCP) servers, based on research of open-source agent libraries and analysis of tool-calling patterns.

## Key Findings from Research

### 1. Open-Source Agent Libraries with MCP Support

- **mcp-agent** (LastMile AI): Purpose-built framework for MCP with composable agent patterns
- **OpenAI Agents SDK**: Native MCP support via MCPServerStdio and related classes
- **Pydantic AI**: MCP integration for Python-based agents
- **LangChain**: Compatibility layers for MCP tools

### 2. Tool Description Patterns

Based on analysis of successful MCP implementations:

#### Effective Description Structure

- **Start with action verb**: "Navigate to", "Search for", "Locate", "Find"
- **Include domain context**: Mention what type of symbols/entities the tool operates on
- **Specify scope**: Clarify if tool works on single file vs entire codebase
- **Length**: 8-15 words optimal (concise but informative)

#### Parameter Description Guidelines

- **Be specific about format**: "Absolute or relative path" vs just "Path"
- **Include constraints**: "0-based line number" vs "line number"
- **Provide context**: "Line where symbol appears" vs just "Line"

### 3. Tool Selection Behavior

Agents tend to select tools based on:

1. **Keyword matching**: Direct matches between query terms and tool names/descriptions
2. **Semantic understanding**: Related concepts (e.g., "usages" → "references")
3. **Action inference**: Understanding user intent from action verbs

## Recommended Tool Description Improvements

### Current vs Optimized Descriptions

#### go_to_definition

**Current**: "Find the definition of a symbol at a specific location in a file"
**Optimized**: "Navigate to symbol definition - jumps to where a function, class, or variable is originally declared"

**Why it's better**:

- Starts with clear action verb ("Navigate")
- Uses multiple synonyms ("definition", "declared", "originally")
- Provides concrete examples of symbols

#### find_references

**Current**: "Find all references to a symbol at a specific location across all files"
**Optimized**: "Locate symbol usages - discovers all places where a function, class, or variable is referenced in the codebase"

**Why it's better**:

- Uses "usages" which is a common user term
- "Discovers" implies comprehensive search
- "Codebase" is clearer than "across all files"

### Parameter Description Improvements

```typescript
// Optimized parameter descriptions
inputSchema: {
  type: "object",
  properties: {
    file_path: {
      type: "string",
      description: "Absolute or relative path to source file containing the symbol"
      // Better than: "Path to the file"
    },
    position: {
      type: "object",
      properties: {
        row: {
          type: "number",
          description: "Line number (0-based) where symbol appears"
          // Better than: "0-indexed line number"
        },
        column: {
          type: "number",
          description: "Column position (0-based) within the line"
          // Better than: "0-indexed column number"
        }
      }
    }
  }
}
```

## Description Style Analysis

### 1. Technical Style

- **Pros**: Precise, unambiguous for technical users
- **Cons**: May not match natural language queries
- **Example**: "Resolve symbol to its declaration AST node"

### 2. User-Friendly Style

- **Pros**: Matches how users naturally express intent
- **Cons**: May be less precise
- **Example**: "Jump to where this code is defined"

### 3. Comprehensive Style

- **Pros**: Covers many use cases and synonyms
- **Cons**: Can be verbose
- **Example**: "Navigate to the original definition of a symbol (function, class, variable, type, etc.) from any usage location"

### 4. Minimal Style

- **Pros**: Clean, simple
- **Cons**: May not provide enough context for disambiguation
- **Example**: "Go to definition"

**Recommendation**: Use a **balanced user-friendly style** with technical accuracy. Include common synonyms and concrete examples where helpful.

## Implementation Recommendations

### 1. Tool Naming

- Use snake_case consistently
- Make names action-oriented when possible
- Keep names intuitive but specific

### 2. Description Writing

- Lead with action verb
- Include 1-2 synonyms for key concepts
- Mention concrete examples of what the tool operates on
- Specify scope clearly (file vs project-wide)

### 3. Parameter Documentation

- Always specify format expectations
- Include valid ranges or constraints
- Use consistent terminology across tools
- Provide examples in complex cases

### 4. Testing Tool Descriptions

- Test with various phrasings of common queries
- Ensure tools are selected appropriately for their intended use cases
- Consider how non-technical users might phrase requests
- Validate that parameter descriptions prevent common errors

## Future Considerations

1. **Fine-tuned Models**: Future LLMs may be optimized specifically for MCP tool usage
2. **Dynamic Descriptions**: Tools might adapt descriptions based on user context
3. **Multi-language Support**: Consider internationalization of tool descriptions
4. **Usage Analytics**: Track which descriptions lead to successful tool usage

## Conclusion

Effective MCP tool descriptions balance technical precision with user-friendly language. By following these best practices, we can improve agent tool selection accuracy and reduce user friction when interacting with our MCP server.
