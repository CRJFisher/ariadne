---
id: TASK-190.18.14
title: Document the chain & loop in canonical style
status: To Do
assignee: []
created_date: "2026-04-29 10:35"
updated_date: "2026-04-29 14:27"
labels:
  - self-repair
  - fix-sequencer
  - documentation
dependencies:
  - TASK-190.18.3
  - TASK-190.18.5
  - TASK-190.18.9
  - TASK-190.18.11
parent_task_id: TASK-190.18
priority: medium
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Future agents (and humans) need a clear picture of how the three skills compose into the self-healing loop. Without canonical-style docs the chain is implicit; the third skill is the natural place to document it.

## Scope

### Cross-references between skill READMEs

- `.claude/skills/self-repair-pipeline/README.md` (or SKILL.md): reference downstream `triage-curator` and `fix-sequencer`
- `.claude/skills/triage-curator/README.md`: reference upstream `self-repair-pipeline` and downstream `fix-sequencer`
- `.claude/skills/fix-sequencer/README.md`: reference upstream chain and the worker-contract doc

### Loop closure docs in fix-sequencer SKILL.md

- Section: "How the loop closes"
- Explain: registry as shared truth between detection and fix-delivery (status: wip → fixed)
- Explain: graph + state log as shared truth between planning and worker execution
- Explain: backlog holds task content in between
- Three stores, one per concern, no parallel pipelines

### Chain diagram

- ASCII or Mermaid chain diagram of `self-repair-pipeline → triage-curator → fix-sequencer → worker → reconciler` showing the three stores

## Style

Canonical and self-contained per CLAUDE.md (no "new" / "updated" / "now" framing, no defensive justifications).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Each of the three skill READMEs contains the substrings of the other two skill names in a section titled `Upstream` or `Downstream` (or both)
- [ ] #2 Loop-closure section in fix-sequencer SKILL.md describes the registry contract: `done` event in state.jsonl → reconciler flips `registry.status: wip → fixed` → `diff_runs --annotate-fixes` labels expected transitions
- [ ] #3 grep across the three READMEs returns zero hits for "now ", "previously", "deprecated", "old approach"
- [ ] #4 Mermaid or ASCII diagram of the chain present in fix-sequencer README, depicting the three stores (registry, backlog, graph+state) and the four actors (pipeline, curator, sequencer, worker)
<!-- AC:END -->
