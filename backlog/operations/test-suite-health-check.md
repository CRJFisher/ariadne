# Test Suite Health Check

## Purpose
Monitor the health of the test suite to prevent regression, track skipped tests, and ensure comprehensive coverage.

## Frequency
- **Automated**: On every PR (CI)
- **Manual Review**: Weekly
- **Deep Audit**: Monthly

## Process Steps

### 1. Daily Automated Checks (CI)

```yaml
# In CI pipeline
- name: Test Suite Health
  run: |
    npm test -- --coverage
    npx vitest run --reporter=json > test-results.json
    node scripts/analyze-test-health.js test-results.json
```

### 2. Weekly Manual Review

#### Count Test Status
```bash
# Get current test counts
npm test 2>&1 | grep "Tests" | tail -1
# Example output: Tests  2 failed | 490 passed | 21 skipped (513)

# List skipped tests
npx vitest run --reporter=verbose 2>&1 | grep "↓" > skipped-tests.txt

# List failing tests
npx vitest run --reporter=verbose 2>&1 | grep "×" > failing-tests.txt
```

#### Analyze Skipped Tests
For each skipped test, categorize:
- **Obsolete**: Can be deleted
- **Broken**: Needs fixing (create task)
- **Future Feature**: Keep skipped (document why)
- **Flaky**: Needs investigation

#### Coverage Analysis
```bash
# Generate coverage report
npm test -- --coverage

# Check coverage trends
git log --format="%ad" --date=short -n 10 | while read date; do
  git checkout $(git rev-list -n 1 --before="$date" HEAD)
  npm test -- --coverage --silent | grep "All files"
done
```

### 3. Monthly Deep Audit

#### Test Performance
```bash
# Find slow tests
npx vitest run --reporter=verbose | grep -E "ms$" | sort -rn -k2 | head -20
```

#### Test Stability
Run tests multiple times to find flaky tests:
```bash
for i in {1..10}; do
  echo "Run $i"
  npm test 2>&1 | grep -E "passed|failed"
done
```

#### Dead Test Detection
Find tests that never fail (might not be testing anything):
```bash
# Temporarily break each module and see if tests fail
# This is manual but important for test quality
```

## Metrics to Track

### Key Indicators
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Test Pass Rate | 100% | <98% |
| Skipped Tests | <10 | >20 |
| Coverage | >80% | <75% |
| Test Runtime | <30s | >60s |
| Flaky Tests | 0 | >2 |

### Trend Tracking
Track week-over-week changes:
- New tests added
- Tests removed/deleted
- Coverage delta
- Runtime changes
- Skip/fail transitions

## Output Locations

```
test-reports/
├── weekly/
│   ├── YYYY-WW-summary.md
│   ├── skipped-tests.txt
│   ├── failing-tests.txt
│   └── coverage-report.html
├── monthly/
│   ├── YYYY-MM-audit.md
│   ├── slow-tests.json
│   ├── flaky-tests.json
│   └── recommendations.md
└── trends/
    ├── coverage-over-time.csv
    ├── test-count-history.csv
    └── performance-metrics.csv
```

## Report Template

```markdown
# Test Suite Health Report - [DATE]

## Summary
- Total Tests: X (△ +Y from last week)
- Passing: X (X%)
- Failing: X
- Skipped: X
- Coverage: X% (△ +Y%)

## Status: 🟢 Healthy / 🟡 Attention Needed / 🔴 Critical

## This Week's Changes
### New Tests Added
- [List of new test files/suites]

### Tests Fixed
- [List of previously failing/skipped tests now passing]

### New Failures
- [List with error summaries]

### Newly Skipped
- [List with reasons]

## Action Items
- [ ] Fix failing test: [test name]
- [ ] Investigate flaky test: [test name]
- [ ] Remove obsolete test: [test name]
- [ ] Improve coverage in: [module]

## Performance
- Average runtime: Xs
- Slowest test: [name] (Xs)
- Memory usage: XMB peak
```

## Automation Scripts

### `scripts/analyze-test-health.js`
```javascript
// Analyzes test results and outputs health metrics
const results = require(process.argv[2]);

const health = {
  total: results.numTotalTests,
  passed: results.numPassedTests,
  failed: results.numFailedTests,
  skipped: results.numPendingTests,
  passRate: (results.numPassedTests / results.numTotalTests * 100).toFixed(2),
  runtime: results.startTime ? Date.now() - results.startTime : 0
};

// Alert if health degrades
if (health.passRate < 98) {
  console.error(`⚠️ Test pass rate below threshold: ${health.passRate}%`);
  process.exit(1);
}

console.log(JSON.stringify(health, null, 2));
```

## Response Procedures

### When Tests Fail
1. **In CI**: Block merge until fixed
2. **In main branch**: Revert or hotfix within 1 hour
3. **Pattern of failures**: Create priority task

### When Coverage Drops
1. **Small drop (<2%)**: Note in weekly report
2. **Medium drop (2-5%)**: Investigate cause
3. **Large drop (>5%)**: Block release, add tests

### When Tests Are Skipped
1. **Temporary skip**: Must include TODO comment
2. **Permanent skip**: Must document in this file
3. **>20 skipped**: Dedicate sprint to cleanup

## Integration Points

### GitHub Actions
```yaml
- name: Test Health Check
  if: always()
  run: |
    node scripts/analyze-test-health.js test-results.json
    echo "::notice::Test Health: ${{ steps.health.outputs.status }}"
```

### Slack Notifications
```javascript
// Post weekly summary to #eng-testing channel
if (dayOfWeek === 'Monday') {
  postToSlack(generateWeeklySummary());
}
```

## Related Documents
- `performance-benchmarking.md`: Performance testing
- `agent-validation-process.md`: External validation
- `WORK_PRIORITY.md`: Current sprint priorities

## Owner
**Team**: Engineering
**Reviewer**: Tech Lead
**Last Updated**: 2024-08-06