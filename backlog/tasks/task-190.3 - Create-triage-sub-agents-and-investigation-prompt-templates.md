---
id: task-190.3
title: Create triage sub-agents and investigation prompt templates
status: Done
assignee: []
created_date: '2026-02-17 16:57'
updated_date: '2026-02-18 09:56'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the three triage-phase custom sub-agents and their diagnosis-specific prompt templates. The triage-investigator agent investigates one entry using MCP tools (`show_call_graph_neighborhood`) and returns structured JSON classification using ternary classification: true-positive, dead-code, or false-positive. The triage-aggregator groups false positives by shared root cause. The triage-rule-reviewer identifies patterns in escape-hatch results that could become deterministic classification rules. Prompt templates are diagnosis-specific markdown files that separate investigation protocol from orchestration logic.

All prompt templates classify entries as true-positive, dead-code, or false-positive. After registry filtering, remaining entries include both dead code and false positives. This aligns with the task-189 taxonomy (`category` + `classification_reason`).

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

### Agent Definitions

#### triage-investigator

```yaml
---
name: triage-investigator
description: Investigates a single entry point to classify it as true positive, dead code, or false positive. Returns structured JSON.
model: sonnet
tools: Read, Grep, Glob
mcpServers:
  - ariadne
maxTurns: 15
---
```

**Instructions**: Structured investigation protocol:

1. Verify callers exist (review pre-gathered grep results, run additional searches)
2. Check call graph coverage using `show_call_graph_neighborhood` MCP tool
3. Classify: true positive / dead code / false positive with group_id and root_cause
4. Output ONLY a JSON classification block

The sub-agent works in its own context. Only the final JSON classification returns to the top-level. All investigation reasoning stays in the sub-agent's context.

#### triage-aggregator

```yaml
---
name: triage-aggregator
description: Groups completed triage results by shared root cause. Merges duplicate group IDs into canonical groupings.
model: opus
tools: Read
maxTurns: 5
---
```

**Instructions**: Read the state file, review all false positive classifications, group by shared root cause, merge duplicate group_ids. Output JSON with canonical groups.

#### triage-rule-reviewer

```yaml
---
name: triage-rule-reviewer
description: Reviews escape-hatch triage results and identifies patterns that could become deterministic classification rules.
model: sonnet
tools: Read, Grep
maxTurns: 10
---
```

**Instructions**: Find entries that required LLM investigation (`route="llm-triage"`), identify common metadata patterns within each group_id, propose deterministic rules that could catch these entries without LLM. Each proposed rule gets a confidence rating (HIGH/MEDIUM/LOW). Only HIGH confidence rules recommended for automatic addition.

### Example Prompt Template

```markdown
# templates/prompt_callers_not_in_registry.md
## Investigation: Callers Not in Registry

This entry has textual callers (found by grep) but Ariadne's call registry
has no matching call references.

### Required Steps

1. Read the calling file(s) listed in grep results. Confirm these are real
   invocations (not string matches, comments, or type annotations).
2. Use `show_call_graph_neighborhood` on the caller function to check if
   Ariadne indexed the caller at all.
3. If the caller IS indexed but the call is not registered: identify the
   specific call pattern that Ariadne fails to parse (method chain, dynamic
   dispatch, decorators, etc.)
4. If the caller is NOT indexed: identify why (test file? excluded folder?
   file type not supported?)

### Output

Return ONLY a JSON block:
{
  "is_true_positive": false,
  "is_likely_dead_code": false,
  "group_id": "<kebab-case describing the detection gap>",
  "root_cause": "<what pattern Ariadne fails to handle>",
  "reasoning": "<specific evidence from your investigation>"
}
```

Claude reads the template, substitutes the entry's metadata, and passes it as the sub-agent's prompt. This separates the investigation protocol (in files) from the orchestration logic (in SKILL.md).

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 triage-investigator agent: sonnet model, Read/Grep/Glob tools, ariadne MCP server, 15 max turns
- [x] #2 triage-aggregator agent: sonnet model (changed from opus per plan — aggregation is structured pattern matching), Read tools, 5 max turns
- [x] #3 triage-rule-reviewer agent: sonnet model, Read/Grep tools, 10 max turns
- [x] #4 Template: prompt_callers_not_in_registry.md — for entries with textual callers but no registry matches
- [x] #5 Template: prompt_resolution_failure.md — for entries where Ariadne failed to resolve the call target
- [x] #6 Template: prompt_wrong_target.md — for entries where caller resolves to wrong target
- [x] #7 Template: prompt_generic.md — escape-hatch for entries not matching any specific diagnosis
- [x] #8 All agents output structured JSON matching TriageEntryResult interface
- [x] #9 Agent instructions reference prompt templates from the skill directory
<!-- AC:END -->


## Implementation Plan

1. Create .claude/agents/triage-investigator.md with YAML frontmatter and investigation protocol
2. Create .claude/agents/triage-aggregator.md with grouping instructions
3. Create .claude/agents/triage-rule-reviewer.md with pattern identification instructions
4. Create .claude/skills/self-repair-pipeline/templates/prompt_callers_not_in_registry.md
5. Create .claude/skills/self-repair-pipeline/templates/prompt_resolution_failure.md
6. Create .claude/skills/self-repair-pipeline/templates/prompt_wrong_target.md
7. Create .claude/skills/self-repair-pipeline/templates/prompt_generic.md
8. Validate agents can be discovered by Claude Code (correct frontmatter format)


## Implementation Notes

### Files Created

**Agents** (`.claude/agents/`):

- `triage-investigator.md` — sonnet, Read/Grep/Glob + ariadne MCP, 15 maxTurns. Generic investigation protocol with ternary classification. Diagnosis-specific steps injected by orchestrator via templates.
- `triage-aggregator.md` — sonnet (changed from opus per plan rationale), Read, 5 maxTurns. Groups false-positive results by shared root cause, merges duplicate group_ids.
- `triage-rule-reviewer.md` — sonnet, Read/Grep, 10 maxTurns. Identifies metadata patterns for deterministic rules with HIGH/MEDIUM/LOW confidence ratings.

**Templates** (`.claude/skills/self-repair-pipeline/templates/`):

- `prompt_callers_not_in_registry.md` — `callers-not-in-registry` diagnosis
- `prompt_resolution_failure.md` — `callers-in-registry-unresolved` diagnosis
- `prompt_wrong_target.md` — `callers-in-registry-wrong-target` diagnosis
- `prompt_generic.md` — `no-textual-callers` and fallback

### Design Decisions

- **Aggregator model changed to sonnet**: Grouping entries by comparing `group_id` and `root_cause` strings is structured pattern matching. Sonnet handles this well and is cheaper. Trivial to change later if needed.
- **Templates use `{{placeholder}}` markers**: The orchestrator (task-190.5) reads templates, loads `TriageEntry` + `EnrichedFunctionEntry` from the analysis file, and substitutes placeholders before passing to the investigator agent.
- **Investigator body is generic**: No diagnosis-specific steps in the agent definition. Templates provide the specialization. This keeps the agent reusable across all diagnosis types.
- **`## Context` section folded into `# Purpose`**: Matches existing agent convention where context is part of the purpose paragraph.
