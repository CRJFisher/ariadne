# Agent Validation Process

## Purpose
Validate Ariadne's API completeness and accuracy by running it against its own codebase and comparing results with the documented API in `packages/core/README.md`.

## Process

### 1. Run Validation

```bash
cd packages/core/agent-validation
npx tsx validate-ariadne.ts > ariadne-validation-output.yaml
```

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

- `meta`: Summary statistics
- `top_level_nodes`: Entry point functions
- `sampled_nodes`: Detailed function analysis with calls
- `file_summary`: Per-file statistics
- `validation_stats`: Quality metrics

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

## Contact

**Owner**: Engineering Team
**Last Updated**: 2025-08-06
