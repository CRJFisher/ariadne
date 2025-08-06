# Release Checklist

## Purpose
Ensure consistent, high-quality releases with proper testing, documentation, and communication.

## Frequency
- **Regular Releases**: Bi-weekly
- **Hotfixes**: As needed
- **Major Versions**: Quarterly

## Pre-Release Checklist

### 1 Week Before Release

#### Code Readiness
- [ ] All planned features merged to main
- [ ] No P0/P1 bugs in backlog
- [ ] Feature flags configured correctly
- [ ] Performance benchmarks run and acceptable

#### Testing
- [ ] All tests passing (0 failures)
- [ ] Skipped tests documented with reasons
- [ ] Coverage meets threshold (>80%)
- [ ] Agent validation run on 3+ external repos
- [ ] Manual smoke tests completed

#### Documentation
- [ ] CHANGELOG.md updated with all changes
- [ ] README.md reflects new features
- [ ] API documentation generated
- [ ] Migration guide written (if breaking changes)

### Release Day

#### Version Management
```bash
# 1. Update version numbers
npm version minor # or major/patch

# 2. Update package versions
cd packages/core
npm version minor
cd ../mcp
npm version minor

# 3. Update dependencies
npm update
```

#### Final Validation
```bash
# Run complete test suite
npm test

# Run validation suite
cd agent-validation
npm run validate:all

# Build all packages
npm run build:all

# Dry run publish
npm publish --dry-run
```

#### Git Operations
```bash
# Create release branch
git checkout -b release/v$(node -p "require('./package.json').version")

# Tag release
git tag -a v$(node -p "require('./package.json').version") -m "Release v$(node -p "require('./package.json').version")"

# Push to remote
git push origin release/v$(node -p "require('./package.json').version")
git push origin --tags
```

## Release Process

### Step 1: Package Publishing
```bash
# Publish to NPM
cd packages/core
npm publish

cd ../mcp  
npm publish

# Verify publication
npm view @ariadnejs/core version
npm view @ariadnejs/mcp version
```

### Step 2: GitHub Release
1. Go to GitHub Releases
2. Create release from tag
3. Add release notes from CHANGELOG
4. Attach built artifacts if needed
5. Mark as pre-release if beta

### Step 3: Documentation Deploy
```bash
# Update documentation site
npm run docs:build
npm run docs:deploy

# Verify docs are live
curl https://docs.ariadnejs.com/version
```

## Post-Release

### Verification (Within 1 Hour)
- [ ] NPM packages accessible
- [ ] Installation works: `npm install @ariadnejs/core`
- [ ] Basic functionality test
- [ ] No critical errors in error tracking

### Communication
- [ ] Post to Discord/Slack announcement channel
- [ ] Update Twitter/Social media if major release
- [ ] Email key stakeholders
- [ ] Update internal wikis/docs

### Monitoring (24 Hours)
- [ ] Check NPM download stats
- [ ] Monitor GitHub issues for problems
- [ ] Review error tracking dashboards
- [ ] Respond to community questions

## Rollback Procedure

### If Critical Issues Found
```bash
# 1. Unpublish broken version (within 72 hours)
npm unpublish @ariadnejs/core@broken-version

# 2. Revert commits
git revert <commit-hash>

# 3. Release patch version
npm version patch
npm publish

# 4. Communicate
# Post incident report
```

## Release Notes Template

```markdown
# v{VERSION} - {DATE}

## 🎉 Highlights
- Major feature or improvement
- Performance enhancement
- Important fix

## ✨ Features
- **Feature Name**: Description (#PR)
- **Enhancement**: What it does (#PR)

## 🐛 Bug Fixes
- Fixed issue with X (#issue)
- Resolved problem in Y (#issue)

## 💔 Breaking Changes
- API change: old_method() → new_method()
- Config format updated (see migration guide)

## 📚 Documentation
- Added guide for X
- Updated API docs for Y

## 🙏 Contributors
Thanks to @user1, @user2 for contributions!

## 📦 Installation
\`\`\`bash
npm install @ariadnejs/core@{VERSION}
\`\`\`

## 🔄 Migration Guide
[Link to migration guide if applicable]
```

## Quality Gates

### Must Pass Before Release
| Check | Threshold | Command |
|-------|-----------|---------|
| Tests | 100% pass | `npm test` |
| Coverage | >80% | `npm test -- --coverage` |
| Lint | 0 errors | `npm run lint` |
| Type Check | 0 errors | `npm run typecheck` |
| Build | Success | `npm run build` |
| Validation | >90% accuracy | `npm run validate` |

### Should Review
- Security audit: `npm audit`
- Bundle size: `npm run size`
- Performance: `npm run benchmark`
- Dependencies: `npm outdated`

## Version Strategy

### Semantic Versioning
- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backwards compatible
- **PATCH** (0.0.X): Bug fixes only

### Pre-releases
- Alpha: `X.Y.Z-alpha.N` - Internal testing
- Beta: `X.Y.Z-beta.N` - External testing
- RC: `X.Y.Z-rc.N` - Release candidate

## Release Schedule

### Regular Cadence
- **Patch releases**: As needed for critical fixes
- **Minor releases**: Bi-weekly (every other Tuesday)
- **Major releases**: Quarterly (Jan, Apr, Jul, Oct)

### Freeze Periods
- No releases on Fridays
- No releases during holidays
- Hotfix-only during freeze periods

## Artifacts

### What Gets Released
- NPM packages: @ariadnejs/core, @ariadnejs/mcp
- GitHub release with changelog
- Documentation updates
- Docker images (if applicable)

### Output Locations
```
releases/
├── v{VERSION}/
│   ├── CHANGELOG.md
│   ├── release-notes.md
│   ├── validation-report.md
│   ├── npm-publish.log
│   └── artifacts/
│       ├── core-{VERSION}.tgz
│       └── mcp-{VERSION}.tgz
└── metrics/
    └── release-metrics.csv
```

## Troubleshooting

### Common Issues
1. **NPM publish fails**: Check auth token
2. **Tests fail on release branch**: Ensure clean build
3. **Version mismatch**: Sync all package.json files
4. **Tag already exists**: Delete and recreate

### Emergency Contacts
- **Release Manager**: @team-lead
- **On-call Engineer**: Check rotation schedule
- **NPM Admin**: @npm-admin

## Related Documents
- `agent-validation-process.md`: Pre-release validation
- `test-suite-health-check.md`: Test requirements
- `performance-benchmarking.md`: Performance gates

## Owner
**Team**: Engineering
**Approver**: Tech Lead
**Last Updated**: 2024-08-06