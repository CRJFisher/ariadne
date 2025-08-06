# Agent Validation Process

## Purpose
Continuously validate Ariadne's accuracy and capabilities using AI agents to ensure the tool meets quality thresholds across diverse codebases.

## Frequency
- **Minimum**: Before each release
- **Recommended**: Weekly during active development
- **Critical**: After major refactoring or feature changes

## Process Steps

### 1. Preparation
```bash
# Ensure latest Ariadne build
cd packages/core
npm run build

# Clear previous validation results
mkdir -p validation-results/$(date +%Y-%m-%d)
```

### 2. Self-Validation (Baseline)
Run against Ariadne itself to ensure self-analysis works:

```bash
cd agent-validation
npx tsx validate-ariadne.ts > ../validation-results/$(date +%Y-%m-%d)/ariadne-self.json
```

**Success Criteria:**
- Functions detected: > 200
- Cross-file calls: > 50
- All language files parsed successfully

### 3. Diverse Repository Validation

Test against repositories of varying complexity and languages:

#### Small TypeScript Project
```bash
git clone https://github.com/example/small-ts-project /tmp/test-repos/small-ts
cd agent-validation
npx tsx validate-generic.ts /tmp/test-repos/small-ts > ../validation-results/$(date +%Y-%m-%d)/small-ts.json
```

#### Medium Multi-Language Project
```bash
git clone https://github.com/example/medium-mixed /tmp/test-repos/medium
cd agent-validation
npx tsx validate-generic.ts /tmp/test-repos/medium > ../validation-results/$(date +%Y-%m-%d)/medium-mixed.json
```

#### Large Production Codebase
```bash
# Use a known open-source project like VSCode, React, etc.
git clone https://github.com/microsoft/vscode /tmp/test-repos/vscode
cd agent-validation
npx tsx validate-generic.ts /tmp/test-repos/vscode --sample > ../validation-results/$(date +%Y-%m-%d)/large-vscode.json
```

### 4. Metrics Collection

Key metrics to track:
- **Parse Success Rate**: % of files successfully parsed
- **Function Detection**: Total functions found vs expected
- **Cross-file Resolution**: % of imports resolved
- **Method Call Accuracy**: % of method calls correctly linked
- **Performance**: Time to analyze per KLOC
- **Memory Usage**: Peak memory for large repos

### 5. Regression Detection

Compare with previous validation results:

```bash
node compare-validations.js \
  validation-results/$(date -d "last week" +%Y-%m-%d) \
  validation-results/$(date +%Y-%m-%d)
```

Flag any metric that degrades by >5%.

### 6. Report Generation

Create summary report:

```markdown
# Validation Report - [DATE]

## Summary
- Overall Health: 🟢 PASS / 🟡 WARN / 🔴 FAIL
- Repos Tested: X
- Critical Issues: None / List

## Metrics
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Parse Success | >95% | X% | ✅/❌ |
| Function Detection | >90% | X% | ✅/❌ |
| Cross-file Resolution | >85% | X% | ✅/❌ |
| Method Call Accuracy | >80% | X% | ✅/❌ |

## Regressions
- None detected / List changes

## Recommendations
- Action items based on findings
```

## Output Locations

```
validation-results/
├── YYYY-MM-DD/
│   ├── ariadne-self.json
│   ├── small-ts.json
│   ├── medium-mixed.json
│   ├── large-vscode.json
│   ├── metrics-summary.json
│   └── validation-report.md
├── comparisons/
│   └── YYYY-MM-DD-vs-YYYY-MM-DD.json
└── trends/
    └── metrics-over-time.csv
```

## Automation Opportunities

### GitHub Actions Workflow
```yaml
name: Weekly Validation
on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
  workflow_dispatch: # Manual trigger

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build
      - run: ./scripts/run-validation-suite.sh
      - uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: validation-results/
```

### Slack/Discord Notifications
- Post summary to team channel
- Alert on regressions >5%
- Weekly trend charts

## Known Issues & Limitations

### Current Limitations to Track
1. Method chaining not supported
2. Namespace imports not resolved
3. Files >32KB require special handling
4. TSX parsing limited

### Expected Failures
Document repos/patterns that are known to fail:
- Heavily macro-based code (Rust)
- Dynamic imports (JavaScript)
- Complex metaprogramming (Python)

## Continuous Improvement

### After Each Run
1. Update this document with new test repos
2. Adjust thresholds based on realistic expectations
3. Add new metrics as capabilities expand
4. Document new failure patterns

### Monthly Review
1. Analyze trends across all validations
2. Identify most common failure patterns
3. Prioritize fixes based on impact
4. Update test repository list

## Related Documents
- `task-84`: Create generic validation script
- `WORK_PRIORITY.md`: Current focus areas
- `test-suite-health-check.md`: Internal test monitoring

## Contact
**Owner**: Engineering Team
**Frequency Review**: Monthly
**Last Updated**: 2024-08-06