# Agent Validation Framework

This directory contains tools for validating Ariadne's code analysis capabilities using LLM agents.

## Purpose

The agent validation framework allows Ariadne to analyze its own codebase and produce structured output that can be validated by LLM agents. This "self-testing" approach provides a flexible way to ensure Ariadne's parsing accuracy without rigid test assertions that break with every code change.

## Files

- `validate-ariadne.ts` - Main validation script that analyzes the Ariadne codebase
- `validation-guide.md` - Instructions for LLM agents on how to validate the output
- `ariadne-validation-output.yaml` - Generated output file (created when running the test)

## Usage

Run the validation test:

```bash
cd packages/core/agent-validation
npx tsx validate-ariadne.ts
```

This will:
1. Parse the Ariadne source code (skipping files >32KB due to tree-sitter limitations)
2. Extract call graph information
3. Sample nodes for detailed validation
4. Output results to `ariadne-validation-output.yaml`

## Output Format

The YAML output includes:
- **meta**: Timestamp, version, and summary statistics
- **top_level_nodes**: Functions not called by any other function in the codebase
- **sampled_nodes**: Detailed information about selected functions including their calls
- **file_summary**: Function counts and export information per file

## Validation Process

After running the test, an LLM agent can follow the instructions in `validation-guide.md` to:
1. Verify top-level nodes are correctly identified
2. Validate call relationships between functions
3. Check file summary accuracy
4. Cross-reference import relationships

## Benefits

- **Adaptive**: Validation adapts to code changes without brittle assertions
- **Comprehensive**: Tests real-world parsing on a complex codebase
- **LLM-friendly**: Output format optimized for agent readability
- **Self-documenting**: The validation process itself documents Ariadne's capabilities