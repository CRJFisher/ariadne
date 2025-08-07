# Guidelines

This file references all the rules files that are relevant for different types of tasks. Choose the appropriate rules file for the task at hand.

## Tempo

- As a general practice, be methodical and thorough. It's better to examine and scrutinise the plan from many angles before rushing to implement.
- Once you've thought about your plan, explain it to me and we'll discuss it. I like to be part of the strategy and architecture. Then we can implement.

## Quick Reference

### Task Management

**📋 `rules/backlog.md`** - Core backlog workflow

- When: Starting any task, creating tasks, updating status
- Key commands: `backlog task list --plain`, `backlog task edit <id> -s "In Progress"`
- Critical: Always read task file first, update ACs before implementing

**✅ `rules/backlog-post.md`** - Post-work checklist

- When: After completing implementation work
- Actions: Update ACs, add implementation notes, archive tasks
- Maintenance: Update WORK_PRIORITY.md and task-dependencies.yaml

### Development Standards

**💻 `rules/coding.md`** - Code style and patterns

- When: Writing any code
- Key rules: Small focused files (<32KB), functional style, snake_case naming
- Never: Use stateful classes

**🧪 `rules/testing.md`** - Test requirements

- When: Adding features, fixing bugs, writing tests
- Key rule: Fix issues don't hide them - never modify tests to pass
- Critical: Write tests for all supported languages (JS, TS, Python, Rust)

**🔧 `rules/refactoring.md`** - Refactoring approach

- When: Improving existing code
- Key principle: Move boldly forward, don't maintain backwards compatibility
- Focus: Language-specific features should be explicit
- Follow `rules/folder-structure-migration.md` when reorganizing code

**🌐 `rules/language-support.md`** - Multi-language handling

- When: Adding language-specific features
- Key rule: Add processing functions to LanguageConfiguration
- Structure: Explicit handling of language differences

**📁 `rules/folder-structure-migration.md`** - Feature-based organization

- When: Adding new features or refactoring existing ones
- Structure: Organize by feature category → feature → language tests
- Support: Test file existence = language support (no registry needed)

### Release Process

**🚀 `rules/release.md`** - Complete release workflow

- When: Preparing to release new versions
- Process: Changesets → Version → Build → Test → Tag → Publish
- Critical: All tests must pass, builds must succeed
- Tools: Uses changesets for version management, npm for publishing

## Workflow Overview

1. **Start Work**: Read `rules/backlog.md` → Find task → Set to "In Progress"
2. **Code**: Apply `rules/coding.md` + language-specific rules
3. **Test**: Follow `rules/testing.md` → Test all languages
4. **Complete**: Use `rules/backlog-post.md` checklist → Archive → Update priorities

## Critical Reminders

- **Always use `--plain` flag** with backlog commands for AI-friendly output
- **Keep files small and focused** - tree-sitter has 32KB parsing limit
- **Add tests for all supported languages** before marking tasks complete
- **Document test gaps** in Implementation Notes when closing tasks
