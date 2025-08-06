---
id: task-54
title: Transform Ariadne MCP from navigation to context-oriented tools
status: To Do
assignee:
  - '@claude'
created_date: '2025-07-30'
updated_date: '2025-07-30'
labels: []
dependencies: []
---

## Description

Redesign Ariadne's MCP interface to provide rich code context instead of position-based navigation, making it compatible with all major coding agents. Current navigation-oriented tools (go_to_definition, find_references) require exact file positions, making them incompatible with most coding agents that work with whole files or natural language queries. By shifting to context-oriented tools, we can provide the information agents actually need for code generation and understanding.

## Acceptance Criteria

- [ ] Context-oriented tools designed and documented
- [ ] Core tools implemented (get_symbol_context get_code_structure find_related_code)
- [ ] Agent adapters created for major platforms (Aider Continue OpenDevin AutoGen)
- [ ] Performance benchmarks met (<200ms for most operations)
- [ ] Migration path from navigation tools completed
- [ ] Comprehensive test suite with >90% coverage
- [ ] Documentation and examples for each tool
- [ ] Backwards compatibility maintained during transition

## Implementation Plan

## Phase 1: Research and Design

1. Analyze existing Ariadne code graph capabilities
2. Design context-oriented tool interfaces:
   - get_symbol_context: Rich information about any symbol
   - get_code_structure: Project organization and patterns
   - find_related_code: Discover similar patterns
   - analyze_code_impact: Understand change effects
   - get_implementation_examples: Learn from existing code
3. Define TypeScript interfaces for all context types
4. Create detailed API documentation
5. Design caching strategy for performance

## Phase 2: Core Implementation

### Initial Context-Oriented Tools Proposal

The following tools represent initial ideas for context-oriented interfaces. These will be refined based on:

- Agent testing and feedback
- Performance benchmarks
- Real-world usage patterns
- Integration requirements

**Proposed Initial Tools:**

1. `get_symbol_context` - Rich information about any symbol
2. `get_code_structure` - Project organization and patterns
3. `find_related_code` - Discover similar patterns
4. `analyze_code_impact` - Understand change effects
5. `get_implementation_examples` - Learn from existing code

**Implementation priorities will be determined through:**

- Simulation of agent workflows
- Analysis of most common agent needs
- Performance and feasibility assessments
- Feedback from pilot testing

## Phase 3: Advanced Features (Subject to Refinement)

Based on initial tool implementation and testing, we may add:

- Enhanced pattern matching capabilities
- Semantic understanding features
- Advanced relationship analysis
- Context enrichment pipelines

The exact feature set will evolve based on empirical data from Phase 2.

## Phase 4: Agent Integration

1. Create Aider adapter:
   - Context provider for SEARCH/REPLACE blocks
   - Symbol information for better edits
2. Create Continue integration:
   - New slash commands (/explain, /impact, /related)
   - Context-aware code explanations
3. Create OpenDevin adapter:
   - Context tools as actions
   - Planning phase enhancement
4. Create AutoGen wrapper:
   - Python functions wrapping MCP tools
   - Context aggregation utilities
5. Test each integration with real scenarios

## Phase 5: Migration and Testing

1. Implement backwards compatibility layer
2. Create migration guide for existing users
3. Comprehensive test suite:
   - Unit tests for each context tool
   - Integration tests with agent scenarios
   - Performance benchmarks
   - End-to-end testing
4. Documentation and examples:
   - Tool usage guide
   - Agent integration examples
   - API reference
5. Beta testing with early adopters
6. Performance optimization based on metrics
7. Deprecation plan for navigation tools

## Phase 6: Release and Monitoring

1. Gradual rollout strategy
2. Monitor adoption metrics
3. Gather user feedback
4. Performance monitoring
5. Bug fixes and improvements
6. Create roadmap for future enhancements

## Technical Details

### Current Navigation Tools (To Be Replaced)

```typescript
// Current: Position-based, returns locations
go_to_definition(file: string, position: {row: number, column: number}): Location
find_references(file: string, position: {row: number, column: number}): Location[]
```

Problems:

- Requires exact position (row, column)
- Returns locations, not context
- Incompatible with agents that don't track cursor position
- Limited information for code generation

### New Context-Oriented Tools

#### 1. get_symbol_context

```typescript
interface SymbolContextParams {
  symbol: string;  // Name or code snippet
  searchScope?: "file" | "project" | "dependencies";
  includeTests?: boolean;
}

interface SymbolContext {
  symbol: {
    name: string;
    kind: "function" | "class" | "variable" | "type" | "interface";
    signature: string;
    visibility: "public" | "private" | "protected";
  };
  
  definition: {
    file: string;
    line: number;
    implementation: string;  // Full code
    documentation?: string;  // Comments/JSDoc
    annotations?: string[];  // Decorators/attributes
  };
  
  usage: {
    directReferences: Array<{file: string; line: number; context: string}>;
    imports: Array<{file: string; line: number; importStatement: string}>;
    tests: Array<{file: string; testName: string; line: number}>;
    totalCount: number;
  };
  
  relationships: {
    calls: string[];         // Functions this calls
    calledBy: string[];      // Functions that call this
    extends?: string;        // Parent class/interface
    implements?: string[];   // Implemented interfaces
    dependencies: string[];  // Other symbols used
    dependents: string[];    // Symbols that use this
  };
  
  metrics?: {
    complexity: number;
    linesOfCode: number;
    testCoverage?: number;
  };
}
```

#### 2. get_code_structure

```typescript
interface CodeStructureParams {
  path: string;
  depth?: number;
  includeTests?: boolean;
  includeMetrics?: boolean;
}

interface CodeStructure {
  modules: Map<string, ModuleInfo>;
  keyAbstractions: {
    interfaces: InterfaceInfo[];
    classes: ClassInfo[];
    types: TypeInfo[];
    enums: EnumInfo[];
  };
  patterns: {
    designPatterns: string[];  // Detected patterns
    architecturalStyle: string;
    conventions: Convention[];
  };
  dependencies: DependencyGraph;
  entryPoints: string[];
  configuration: ConfigInfo;
  testStructure?: TestStructure;
}
```

#### 3. find_related_code

```typescript
interface RelatedCodeParams {
  code: string;  // Code snippet or description
  relationshipType?: "similar" | "pattern" | "domain" | "all";
  limit?: number;
}

interface RelatedCode {
  exact: Match[];      // Exact duplicates
  similar: Match[];    // Similar logic/structure
  pattern: Match[];    // Same design pattern
  domain: Match[];     // Same business domain
  tests: TestMatch[];  // Related tests
}
```

### Key Implementation Considerations

1. **Symbol Resolution Without Position**
   - Use fuzzy matching for symbol names
   - Handle overloaded functions
   - Disambiguate with context clues
   - Provide interactive disambiguation when needed

2. **Performance Optimization**
   - Cache symbol table on startup
   - Incremental updates on file changes
   - Lazy loading of implementation details
   - Parallel processing for multi-file operations

3. **Agent-Specific Formatting**
   - Aider: Format as comments above SEARCH blocks
   - Continue: Format as markdown explanations
   - OpenDevin: Format as structured observations
   - AutoGen: Format as Python dictionaries

4. **Backwards Compatibility**
   - Keep navigation tools during transition
   - Add deprecation warnings
   - Provide migration utilities
   - Support both APIs for 6 months

### Example Usage Scenarios

#### Scenario 1: Understanding Before Editing

```typescript
// Agent wants to add error handling to a function
const context = await get_symbol_context({
  symbol: "processPayment",
  includeTests: true
});

// Agent now knows:
// - Function signature and parameters
// - Current error handling approach
// - All places it's called from
// - Existing tests to not break
```

#### Scenario 2: Consistent Code Generation

```typescript
// Agent needs to create a new API endpoint
const structure = await get_code_structure({
  path: "src/api/",
  includeMetrics: true
});

const examples = await find_related_code({
  code: "router.post",
  relationshipType: "pattern"
});

// Agent can now generate code matching existing patterns
```

#### Scenario 3: Safe Refactoring

```typescript
// Agent wants to change an interface
const impact = await analyze_code_impact({
  file: "src/types.ts",
  changes: "Add required field to User interface"
});

// Agent knows what needs updating before making changes
```

### Success Metrics

1. **Adoption**: 80% of MCP calls use context tools vs navigation
2. **Performance**: 95% of requests complete in <200ms
3. **Accuracy**: 90% correct symbol resolution without position
4. **Agent Success**: 50% reduction in position-related errors
5. **Developer Satisfaction**: 4.5/5 rating from agent developers
