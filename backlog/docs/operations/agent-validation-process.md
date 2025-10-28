# Agent Validation Process

## Purpose

Validate Ariadne's API completeness and accuracy by running it against its own codebase and comparing results with the documented API in `packages/core/README.md`.

## Process

### 1. Run Validation

**IMPORTANT: The validation script must be run from the `packages/core` directory, not from `agent-validation`**

```bash
# From project root (/Users/chuck/workspace/ariadne):
cd packages/core

# Run the validation script (it's in agent-validation/ subdirectory):
npx tsx agent-validation/validate-ariadne.ts > agent-validation/ariadne-validation-output.yaml

# Check if it succeeded:
echo "Exit code: $?"  # Should be 0 for success
```

**Common Issues:**

- If you get `ERR_MODULE_NOT_FOUND`, you're in the wrong directory
- The script needs to be run from `packages/core` because it imports from `../src/index`
- The output file will be created in `packages/core/agent-validation/`

### 2. Compare with API Reference

Compare the YAML output against the `## API Reference` section in `packages/core/README.md`:

**Check for missing API methods:**

- Are all public methods from the Project class being detected?
- Are return types and parameters matching documentation?

**Check for undocumented features:**

- Are there public methods in the output that aren't in the README?
- If yes, update the README to include them

### 3. Analyze Discrepancies

For each discrepancy found, classify it as:

1. **Documentation Gap**: Update README.md
2. **Ariadne Bug**: Method exists but not detected
3. **Feature Gap**: Functionality missing from Ariadne

### 4. Create or Update Tasks

For each issue identified:

**Check existing tasks:**

```bash
# Search for related tasks
backlog task list --plain | grep -i [keyword]
```

**If existing task covers it:**

- Add specific example/detail to the task
- Update acceptance criteria if needed

**If new issue:**

- Check if it fits an existing epic
- Create sub-task under appropriate epic OR
- Create standalone task if independent

**For systematic problems:**

- Create new epic with multiple sub-tasks
- Document the pattern clearly

### 5. Example Analysis Process

```yaml
# From validation output
sampled_nodes:
  - node:
      name: "get_call_graph"
      file: "src/project.ts"
    # ... details
```

**Action:** If `get_call_graph` is in output but not in README → Update README
**Action:** If `get_call_graph` is in README but not in output → Create bug task

## Validation Output Structure

The YAML output contains:

- `meta`: Summary statistics (timestamp, version, file/function/call counts)
- `api_methods`: Public API methods from the Project class
- `sampled_functions`: Detailed function analysis with:
  - `name`: Function name
  - `file`: Source file path
  - `line`: Line number
  - `calls`: Functions this function calls
  - `called_by`: Functions that call this function

## Success Criteria

- All documented API methods are detected
- Detection accuracy > 90%
- No false positives in top-level nodes
- Cross-file references resolved correctly

## Files to Maintain

**Keep minimal:**

- `validate-ariadne.ts` - The validation script
- `ariadne-validation-output.yaml` - Latest output

**Remove (replaced by this doc):**

- `validation-guide.md`
- Old validation reports (keep only latest)

## Frequency

- Before each release
- After major refactoring
- When adding language support

## Current Status (2025-08-06)

- ✅ Validation runs successfully
- ✅ Analyzes 341 functions and 372 calls
- ✅ Detects 30+ Project class API methods correctly
- ✅ Core functionality fully validated

## Contact

**Owner**: Engineering Team
**Last Updated**: 2025-08-06
