# Contributing to Ariadne

Thank you for your interest in contributing to Ariadne! This guide will help you get started.

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/CRJFisher/ariadne.git
   cd ariadne
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the packages:

   ```bash
   npm run build
   ```

4. Run tests:

   ```bash
   npm test
   ```

## Making Changes

### Code Style

- Use snake_case for variables and functions (except classes which use PascalCase)
- Follow the existing patterns in the codebase
- Add tests for new functionality

### Creating a Changeset

We use [changesets](https://github.com/changesets/changesets) to manage versions and changelogs. When you make a change that should be included in the changelog:

1. Run the changeset command:

   ```bash
   npm run changeset
   ```

2. Select the packages you've changed
3. Choose the type of change:
   - **patch**: Bug fixes and minor changes
   - **minor**: New features that are backward compatible
   - **major**: Breaking changes

4. Write a summary of your changes

5. Commit the generated changeset file with your PR

### Example Changeset Workflow

```bash
# Make your changes
git add .
git commit -m "feat: add new symbol resolution feature"

# Create a changeset
npm run changeset
# Select @ariadnejs/core
# Select "minor"
# Write: "Added new symbol resolution feature for better cross-file support"

# Commit the changeset
git add .changeset/
git commit -m "chore: add changeset"

# Push and create PR
git push origin your-branch
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Create a changeset (see above)
6. Commit your changes
7. Push to your fork
8. Open a Pull Request

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Project Structure

```
ariadne/
├── packages/
│   ├── core/          # Main implementation with tree-sitter
│   │   ├── src/       # Source code
│   │   └── tests/     # Tests
│   └── types/         # TypeScript types only (zero dependencies)
│       └── src/       # Type definitions
├── docs/              # Documentation
├── backlog/           # Project tasks and decisions
└── .changeset/        # Changeset configuration
```

## Releasing (Maintainers Only)

The release process is fully automated through GitHub Actions:

1. When changesets are pushed to `main`, a "Version Packages" PR is automatically created
2. Review and merge the version PR
3. Upon merge, the following happens automatically:
   - Packages are published to npm
   - A git tag is created (e.g., `v1.2.3`)
   - The prebuild workflow is triggered to create binaries
   - A GitHub release is created with the binaries

No manual steps required!

## Questions?

Feel free to open an issue if you have any questions or need help!
