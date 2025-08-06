# Guidelines

This file references all the rules files that are relevant for different types of tasks. Choose the appropriate rules file for the task at hand.

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
- Key rules: Functional style, immutable classes, snake_case naming
- Never: Use stateful classes

**🧪 `rules/testing.md`** - Test requirements

- When: Adding features, fixing bugs, writing tests
- Key rule: Fix issues don't hide them - never modify tests to pass
- Critical: Test all supported languages (JS, TS, Python, Rust)

**🔧 `rules/refactoring.md`** - Refactoring approach

- When: Improving existing code
- Key principle: Move boldly forward, don't maintain backwards compatibility
- Focus: Language-specific features should be explicit

**🌐 `rules/language-support.md`** - Multi-language handling

- When: Adding language-specific features
- Key rule: Add processing functions to LanguageConfiguration
- Structure: Explicit handling of language differences

## Workflow Overview

1. **Start Work**: Read `rules/backlog.md` → Find task → Set to "In Progress"
2. **Code**: Apply `rules/coding.md` + language-specific rules
3. **Test**: Follow `rules/testing.md` → Test all languages
4. **Complete**: Use `rules/backlog-post.md` checklist → Archive → Update priorities

## Critical Reminders

- **Always use `--plain` flag** with backlog commands for AI-friendly output
- **Never create files** unless absolutely necessary - prefer editing existing
- **Test all languages** before marking tasks complete
- **Document test gaps** in Implementation Notes when closing tasks
