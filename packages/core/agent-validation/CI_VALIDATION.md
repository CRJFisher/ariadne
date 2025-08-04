# CI/CD Validation for Ariadne Self-Analysis

This directory contains validation tools to ensure Ariadne can accurately analyze its own codebase.

## Overview

The validation process runs Ariadne on its own source code and checks that the extracted call graph meets accuracy thresholds. This helps prevent regressions in the core analysis functionality.

## Scripts

- **validate-ariadne.ts**: Runs Ariadne self-analysis and outputs results to YAML
- **ci-validation.ts**: CI/CD wrapper that runs validation and checks against thresholds

## Success Thresholds

The following metrics must meet minimum thresholds for validation to pass:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Top-level accuracy | ≥ 90% | Correctly identified entry point functions |
| Nodes with calls | ≥ 85% | Functions that make calls to other functions |
| Nodes called by others | ≥ 85% | Functions that are called by other functions |
| Edges with call type | ≥ 80% | Call relationships with proper type info |
| Total functions | ≥ 50 | Minimum functions analyzed |
| Total calls | ≥ 100 | Minimum call relationships detected |

## CI/CD Integration

### Current Status

The validation is integrated into the test workflow (`test.yml`) with `continue-on-error: true` since accuracy improvements are still in progress.

### Future State

Once accuracy thresholds are consistently met, the validation can be made mandatory by:

1. Removing `continue-on-error: true` from the test workflow
2. Using the dedicated `validation.yml` workflow for PR validation

## Running Locally

```bash
# From project root
npx tsx packages/core/agent-validation/ci-validation.ts

# Or directly run the validation script
cd packages/core/agent-validation
npx tsx validate-ariadne.ts
```

## Validation Output

The validation creates `ariadne-validation-output.yaml` containing:
- Metadata about the analysis
- List of top-level nodes
- Sampled function details with call relationships
- File summaries
- Validation statistics

## Troubleshooting

If validation fails:

1. Check the specific metrics that failed
2. Review recent changes to the core analysis logic
3. Run the validation locally to debug
4. Use the validation guide to manually verify accuracy

## Related Files

- `validation-guide.md`: Manual validation instructions
- `README.md`: Agent validation documentation
- `.github/workflows/test.yml`: Main CI/CD integration
- `.github/workflows/validation.yml`: Dedicated validation workflow