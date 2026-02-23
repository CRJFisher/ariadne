# Contributing to Ariadne

## Development Setup

```bash
git clone https://github.com/CRJFisher/ariadne.git
cd ariadne
npm install
npm run build
npm test
```

## Code Style

`snake_case` for functions/variables, `PascalCase` for classes. See [CLAUDE.md](CLAUDE.md) for full guidelines.

## Changesets

We use [changesets](https://github.com/changesets/changesets) to manage versions. Before opening a PR:

```bash
npm run changeset
```

Select affected packages, change type (patch/minor/major), and write a summary. Commit the generated file with your PR.

## Pull Requests

1. Fork and create a feature branch
2. Make changes and add tests
3. Create a changeset
4. Open a PR

## Releasing (Maintainers)

Automated via GitHub Actions. When changesets land on `main`, a "Version Packages" PR is created. Merging it publishes to npm and creates a GitHub release with prebuilt binaries.
