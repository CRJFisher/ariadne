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

**Call sites outside the indexed corpus** (files discovered but never indexed — a config `exclude`, a folder scope, or an indexing error):
{{entry.diagnostics.grep_call_sites_outside_index_formatted}}

**Non-call references** (the name reached without call parens — a read, a callback handed to an invoker, a registration value):
{{entry.diagnostics.reference_sites_formatted}}
{{classifier_hints}}

### In-scope classifier rules

The wip + permanent registry rules in scope for this entry (language match). If you find a real caller that one of these rules' classifiers _should_ have matched but did not, emit `fp-classifier-regression` with the rule's `group_id` as `should_have_matched_rule_id`.

```json
{{relevant_registry_slice}}
```

### Investigation Steps

{{diagnosis.investigation_guide}}

### Output

Emit exactly one `TriageVerdict` JSON object — one of the four discriminated kinds below. Write raw JSON (no markdown fencing) to the output path above.

- **`tp`** — genuinely unreachable. Use when no real callers exist anywhere in the codebase.
  ```
  { "kind": "tp", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence on the search that ruled out callers>" } }
  ```
- **`fp-classifier-regression`** — a real caller exists that one of the in-scope classifier rules _should_ have matched but did not.
  ```
  { "kind": "fp-classifier-regression", "should_have_matched_rule_id": "<group_id>", "evidence_excerpt": "<excerpt>", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence>" } }
  ```
- **`fp-novel`** — a real caller exists and no in-scope classifier rule should have matched. A new Ariadne resolver gap; describe it in `proposed_root_cause`.
  ```
  { "kind": "fp-novel", "proposed_root_cause": "<one or two sentences>", "evidence_excerpt": "<excerpt>", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence>" } }
  ```
- **`uncertain`** — the entry cannot be reduced to a single verdict (compounding gaps, ambiguous evidence).
  ```
  { "kind": "uncertain", "reason": "<one sentence>", "member_evidence": { "file": "<path>", "line": <int>, "why": "<one sentence>" } }
  ```
