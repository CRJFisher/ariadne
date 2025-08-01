# Ariadne Agent Validation Guide

This guide provides instructions for LLM agents to validate the accuracy of Ariadne's self-analysis output.

## Overview

The agent validation test runs Ariadne on its own codebase and outputs a YAML file (`ariadne-validation-output.yaml`) containing:
- Top-level function nodes
- Sampled function details with call relationships
- File summaries

Your task is to validate that the parsed data accurately represents the actual codebase structure.

## Running the Agent Validation Test

1. Navigate to the Ariadne repository root
2. Run the test script:
   ```bash
   cd packages/core/agent-validation
   npx tsx validate-ariadne.ts
   ```
3. The output will be saved to `ariadne-validation-output.yaml` in the agent-validation directory

## Validation Steps

### 1. Verify Top-Level Nodes

Top-level nodes are functions that are not called by any other function in the codebase (entry points).

**Validation process:**
1. Pick 3-5 random top-level nodes from the output
2. For each node:
   - Use `grep -n "function_name" packages/` to search for calls to this function
   - Verify that no internal files call this function (only external imports or test files)
   - Check that the function exists at the specified file and line number

**Example validation:**
```bash
# For a top-level node like "index.ts#Project"
grep -r "new Project\|Project(" packages/core/src/ --include="*.ts" | grep -v test
```

### 2. Validate Call Relationships

The sampled_nodes section contains detailed call graph information.

**Validation process:**
1. Pick 2-3 sampled nodes
2. For each node's outgoing_calls:
   - Navigate to the source file and line number
   - Verify that the function actually calls the target functions listed
   - Check that the call locations (line numbers) are accurate

**Example validation:**
```bash
# Check if function A calls function B
cat -n packages/core/src/file.ts | grep -A 10 "function A"
# Look for calls to B within A's body
```

### 3. Verify File Summaries

**Validation process:**
1. Pick 2-3 files from the file_summary
2. For each file:
   - Count functions: `grep -c "function\|=>\|class" file.ts`
   - Count exports: `grep -c "export" file.ts`
   - Verify the counts roughly match (exact matching isn't required due to parsing nuances)

### 4. Cross-Reference Import Relationships

**Validation process:**
1. For nodes with incoming_calls from different files:
   - Verify the source file imports the target file
   - Check that the import statement exists

**Example:**
```bash
# If file2.ts calls a function from file1.ts
grep "import.*from.*file1" packages/core/src/file2.ts
```

## Validation Report Template

After validation, create a report with the following structure:

```markdown
## Ariadne Agent Validation Report

### Summary
- Total nodes validated: X
- Accurate top-level identification: Y/Z (percentage)
- Accurate call relationships: Y/Z (percentage)
- File summary accuracy: High/Medium/Low

### Top-Level Node Validation
- ✅ `node_id`: Correctly identified as top-level
- ❌ `node_id`: Found internal calls at [locations]

### Call Relationship Validation
- ✅ `function_A -> function_B`: Verified at line X
- ❌ `function_C -> function_D`: Call not found

### File Summary Validation
- `file.ts`: Reported X functions, found Y (close match)

### Issues Found
1. [List any parsing errors or inaccuracies]

### Conclusion
[Overall assessment of Ariadne's self-analysis accuracy]
```

## Tips for Validators

1. **Sampling Strategy**: Focus on validating a representative sample rather than every entry
2. **Edge Cases**: Pay special attention to:
   - Arrow functions vs regular functions
   - Class methods
   - Exported vs internal functions
   - Cross-file dependencies
3. **Acceptable Variations**: Small discrepancies in counts are acceptable due to:
   - Different counting methods for anonymous functions
   - Inline arrow functions
   - Method definitions

## Automation Helpers

You can use these bash one-liners to speed up validation:

```bash
# Count function definitions in a file
grep -E "(function |const \w+ = |=>)" file.ts | wc -l

# Find all calls to a specific function
rg "functionName\(" --type ts -A 2 -B 2

# List all exports from a file
grep "^export" file.ts

# Find import statements
grep "^import" file.ts
```

## Success Criteria

The agent validation test is considered successful if:
1. At least 90% of top-level nodes are correctly identified
2. At least 85% of sampled call relationships are accurate
3. File summaries are within 20% of actual counts
4. No major structural parsing errors are found

Remember: The goal is to validate that Ariadne can accurately parse and understand code structure, not to achieve 100% perfect parsing of every edge case.