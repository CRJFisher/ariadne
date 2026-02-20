---
id: task-186
title: Add deterministic classification rule for commented-out callers
status: To Do
assignee: []
created_date: '2026-02-12 18:18'
labels:
  - bug
  - triage-pipeline
dependencies: []
priority: low
---

## Description

The triage pipeline lacks a deterministic rule for functions whose only callers are in commented-out code. Ariadne correctly ignores comments, so these functions appear as entry points. 10 entries in AmazonAdv/projections Feb 12 re-analysis. Add a rule to classify_entrypoints.ts that checks: diagnosis === callers-not-in-registry AND all grep_call_sites start with # or // or contain comment markers AND ariadne_call_refs is empty. Reproduction: clean_amazon_entities.py lines 49-606 has maintenance functions like delete_duplicate_auto_campaigns() where all callers in the if __name__ block are commented out. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-12T18-12-14.458Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Deterministic rule in classify_entrypoints.ts handles commented-out callers,10 entries from AmazonAdv analysis are pre-classified without LLM
<!-- AC:END -->
