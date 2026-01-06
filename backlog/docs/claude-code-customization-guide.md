# Claude Code Customization Guide

A comprehensive reference for all customization options available in Claude Code.

## Quick Reference Matrix

| Feature            | Auto-Applied    | Context   | Execution     | Primary Strength                      |
| ------------------ | --------------- | --------- | ------------- | ------------------------------------- |
| **CLAUDE.md**      | Always          | Injected  | None          | Project context & conventions         |
| **Skills**         | Semantic match  | Shared    | LLM decides   | Complex workflows with auto-discovery |
| **Subagents**      | Delegated       | Isolated  | LLM delegates | Task isolation & specialization       |
| **Hooks**          | Event-triggered | Event I/O | Deterministic | Enforcement & validation              |
| **Slash Commands** | Explicit `/cmd` | Shared    | LLM           | Quick reusable prompts                |
| **MCP Servers**    | Available       | Shared    | LLM uses      | External tool integration             |
| **Settings**       | Always          | N/A       | Config        | Permissions & environment             |
| **Plugins**        | If enabled      | Mixed     | Mixed         | Packaged distribution                 |

## CLAUDE.md — Project Memory

**What**: Markdown files with instructions Claude loads automatically every session.

**Loaded**: Always, at session start. Recursive discovery up/down directory tree.

**Strengths**:

- Zero-effort activation (always present)
- Team-shareable via git
- Supports imports (`@path/to/file`)
- Hierarchical override (child overrides parent)

**Use When**:

- Coding standards & conventions
- Architecture documentation
- Frequently-used commands
- Onboarding context

**Limitations**: Informational only — doesn't execute or enforce anything.

**Locations**: `./CLAUDE.md`, `.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`

## Skills — Auto-Discovered Capabilities

**What**: Markdown files that teach Claude specialized procedures. Claude decides when to apply them.

**Loaded**: Names/descriptions at startup; full content when activated.

**Context**: Shared with main conversation.

**Strengths**:

- Automatic discovery (no explicit invocation)
- Progressive disclosure (supporting files loaded on-demand)
- Tool restrictions via `allowed-tools`
- Can bundle scripts and reference docs

**Use When**:

- Complex multi-step workflows
- Domain knowledge with supporting materials
- Team-wide standards (PR review, testing methodology)
- Read-only analysis skills

**Limitations**: Activation depends on description quality. Restart required for changes.

**Location**: `.claude/skills/{name}/SKILL.md`

## Subagents — Isolated Specialists

**What**: Pre-configured agents with separate context windows, tools, and prompts.

**Loaded**: At startup. Invoked automatically or explicitly.

**Context**: **Isolated** — fresh context, no conversation history from parent.

**Strengths**:

- Context isolation (keeps main conversation clean)
- Custom tool sets per agent
- Model selection per agent
- Resumable across sessions

**Use When**:

- Heavy tasks (code review, debugging, testing)
- Need different tool permissions
- Want to preserve main conversation focus
- Multi-step workflows with potential resume

**Limitations**: Cold start latency. Cannot spawn child subagents. Skills don't auto-inherit.

**Location**: `.claude/agents/{name}.md`

## Hooks — Event-Driven Automation

**What**: Scripts that execute at lifecycle events (before/after tools, on input, etc.).

**Loaded**: Captured at startup. Triggered on matching events.

**Context**: Receives JSON event data. Can block, allow, or modify.

**Strengths**:

- **Deterministic** — doesn't depend on LLM decision-making
- Fine-grained control (block specific files, validate commands)
- Auto-formatting, logging, compliance
- Security policy enforcement

**Use When**:

- Must enforce rules (not just suggest)
- Auto-format after edits
- Protect sensitive files
- Log actions for compliance
- Custom permission logic

**Events**: `PreToolUse`, `PostToolUse`, `PermissionRequest`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `Notification`, `PreCompact`, `SessionStart`, `SessionEnd`

**Limitations**: Requires scripting. Synchronous (blocking).

**Location**: `.claude/settings.json` → `hooks` section

## Slash Commands — Explicit Prompts

**What**: Markdown files invoked with `/command-name` syntax.

**Loaded**: At startup. Only runs when explicitly called.

**Context**: Shared with main conversation.

**Strengths**:

- Simple markdown format
- Argument support (`$ARGUMENTS`, `$1`, `$2`)
- Can embed bash output
- Fast invocation

**Use When**:

- Frequently-used prompts
- Quick templates
- Standardized workflows (commit, PR, review)
- Simple actions that don't need auto-discovery

**Limitations**: Must invoke explicitly. Single file only (no supporting files).

**Location**: `.claude/commands/{name}.md`

## MCP Servers — External Tools

**What**: Servers providing tools, resources, and prompts via Model Context Protocol.

**Loaded**: At session startup. Tools available immediately.

**Context**: Shared — MCP tools appear alongside native tools.

**Strengths**:

- Integrates external APIs, databases, services
- Team-shareable (`.mcp.json` in repo)
- OAuth support
- Resources accessible via `@server:resource`

**Use When**:

- GitHub/GitLab integration
- Database queries
- Monitoring (Sentry, Datadog)
- Slack, email, JIRA workflows
- Any external service

**Limitations**: Network-dependent. External server must be available.

**Location**: `.mcp.json` (project), `~/.claude.json` (user)

## Settings — Permissions & Config

**What**: JSON configuration for permissions, environment, model, hooks.

**Loaded**: At session startup. Precedence: Enterprise > Local > Project > User.

**Strengths**:

- Centralized permission management (allow/ask/deny)
- Environment variable injection
- Model selection
- Sensitive file protection

**Use When**:

- Need to allow/block specific tools or paths
- Set environment variables
- Choose default model
- Configure any runtime behavior

**Location**: `.claude/settings.json`, `~/.claude/settings.json`

## Plugins — Packaged Distribution

**What**: Bundles of commands, agents, skills, hooks, and MCP servers in one distributable unit.

**Loaded**: At startup if enabled.

**Strengths**:

- Single distribution for multiple features
- Versioned releases
- Marketplace distribution
- Namespaced to prevent conflicts

**Use When**:

- Sharing tooling across multiple projects
- Commercial/open-source distribution
- Team-wide capability bundles

**Location**: `.claude-plugin/plugin.json` + component directories

## Decision Tree

```text
Need to...
│
├─ Share project context/standards?
│  └─ CLAUDE.md
│
├─ Auto-apply specialized knowledge?
│  ├─ Complex with supporting files? → Skill
│  └─ Simple prompt template? → Slash Command
│
├─ Delegate to isolated specialist?
│  └─ Subagent
│
├─ Enforce rules deterministically?
│  └─ Hook
│
├─ Connect to external service?
│  └─ MCP Server
│
├─ Control permissions/environment?
│  └─ Settings
│
└─ Distribute multiple features?
   └─ Plugin
```

## LLM vs Deterministic Execution

| LLM-Driven (Claude Decides) | Deterministic (Always Executes) |
| --------------------------- | ------------------------------- |
| Skills                      | Hooks                           |
| Subagents                   | Settings/Permissions            |
| Slash Commands              | CLAUDE.md (always loaded)       |
| MCP tool usage              |                                 |

**Use LLM-driven** for flexible, context-aware behavior.
**Use deterministic** for enforcement, validation, security.

## Context Inheritance Summary

| Feature            | Inherits Parent Context                |
| ------------------ | -------------------------------------- |
| **CLAUDE.md**      | N/A (always injected)                  |
| **Skills**         | Yes — loaded into current conversation |
| **Subagents**      | No — fresh isolated context            |
| **Hooks**          | No — receives event JSON only          |
| **Slash Commands** | Yes — runs in main conversation        |
| **MCP Servers**    | Yes — tools available in main context  |

The key architectural distinction: **Skills add knowledge to the current conversation**, while **Subagents branch off into isolated contexts** for specialized work.
