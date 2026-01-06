---
name: compare-entrypoints
description: Analyzes entry point detection changes after modifying call graph logic. Runs Ariadne entrypoint detection on packages/core and compares against previous runs. Use when verifying whether code changes improved or regressed entry point detection accuracy.
allowed-tools: Bash(npx tsx:*), Read
---

# Entry Point Comparison Analysis

## Purpose

Verify whether recent changes to call graph detection logic improved entry point detection accuracy.

## Instructions

1. Run the entrypoint detection script:

   ```bash
   npx tsx top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts
   ```

2. The script automatically:
   - Analyzes packages/core for entry points
   - Captures git version metadata (commit hash + working tree changes hash)
   - Compares against the most recent analysis with a different code fingerprint
   - Outputs comparison summary showing delta and percentage change

3. Interpret the results:
   - **IMPROVED** (fewer entry points): Changes successfully reduced false positives
   - **REGRESSED** (more entry points): Call graph resolution may have regressed - investigate causes
   - **No change**: Expected if recent changes didn't affect call resolution

4. Provide actionable feedback:
   - Explain WHY the count changed based on recent code modifications
   - Relate the delta to specific changes made
   - Recommend whether to keep, revert, or investigate further

## Key Metrics

- **Fewer entry points = Better** (better call graph resolution)
- Code fingerprint format: `{commit_short}_{working_tree_hash}`
- Legacy files without fingerprint use timestamp for comparison

## Example Output

```text
🔖 Code version: f6c4caf_8f549bb5bf8a8977
...
═══════════════════════════════════════════════════════
           Entry Point Comparison
═══════════════════════════════════════════════════════
Target:   11 entry points (from ground truth)
Current:  216 entry points
Gap:      205 false positives to eliminate

Change:   -2 from previous (abc1234_clean)

Status:   📈 IMPROVING
Progress: 1.0% of gap closed
═══════════════════════════════════════════════════════
```

## Status Meanings

- **✅ TARGET REACHED**: Entry points at or below expected count
- **📈 IMPROVING**: Fewer than before, but still above target
- **⚠️ REGRESSED**: More entry points than before
- **⏸️ NO CHANGE**: Same as previous run
- **🎯 N false positives remaining**: No previous run to compare
