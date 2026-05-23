## Investigation: {{diagnosis.title}}

**Diagnosis**: `{{entry.diagnosis}}` — {{diagnosis.summary}}

### Entry Under Investigation

- **Name**: {{entry.name}}
- **Kind**: {{entry.kind}}
- **File**: {{entry.file_path}}:{{entry.start_line}}
- **Signature**: {{entry.signature}}
- **Exported**: {{entry.is_exported}}
- **Access modifier**: {{entry.access_modifier}}

### Output Location

Write your result JSON to: {{output_path}}

### Pre-Gathered Evidence

**Textual call sites (grep results):**
{{entry.diagnostics.grep_call_sites_formatted}}

**Ariadne call references:**
{{entry.diagnostics.ariadne_call_refs_formatted}}
{{classifier_hints}}

### Novel issues snapshot

The run's current `novel_issues.json` content. If the entry's evidence matches an issue already in `issues`, emit `fp-novel-cited` immediately with the existing `id` — do not re-investigate.

```json
{{novel_issues_snapshot}}
```

### In-scope classifier rules

The wip + permanent registry rules in scope for this entry (language match, or `diagnosis_eq` match for the entry's diagnosis). If you find a real caller that one of these rules' predicates *should* have matched but did not, emit `fp-classifier-regression` with the rule's `group_id` as `should_have_matched_rule_id`.

```json
{{relevant_registry_slice}}
```

### Investigation Steps

{{diagnosis.investigation_guide}}

### Output

Emit exactly one `TriageVerdict` JSON object — one of the five discriminated kinds below. Write raw JSON (no markdown fencing) to the output path above.

- **`tp`** — genuinely unreachable. Use when no real callers exist anywhere in the codebase.
  ```
  { "kind": "tp", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence>" } }
  ```
- **`fp-novel-cited`** — the entry's evidence matches an existing issue in the snapshot above. Early-exit before any source read or MCP call.
  ```
  { "kind": "fp-novel-cited", "novel_issue_id": "<id from snapshot>", "evidence_excerpt": "<excerpt>" }
  ```
- **`fp-classifier-regression`** — a real caller exists that the predicate of one of the in-scope classifier rules *should* have matched but did not.
  ```
  { "kind": "fp-classifier-regression", "should_have_matched_rule_id": "<group_id>", "evidence_excerpt": "<excerpt>", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence>" } }
  ```
- **`fp-novel-new`** — a real caller exists, no rule should have matched, and the gap is not yet in the novel issues snapshot.
  ```
  { "kind": "fp-novel-new", "proposed_root_cause": "<one or two sentences>", "evidence_excerpt": "<excerpt>", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence>" } }
  ```
- **`uncertain`** — the entry cannot be reduced to a single verdict (compounding gaps, ambiguous evidence).
  ```
  { "kind": "uncertain", "reason": "<one sentence>", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence>" } }
  ```
