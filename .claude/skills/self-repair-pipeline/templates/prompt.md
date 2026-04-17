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

### Investigation Steps

{{diagnosis.investigation_guide}}

### Classification Guide

- **Ariadne correct** (`ariadne_correct: true`): No real callers found. `group_id = "confirmed-unreachable"`.
- **False positive** (`ariadne_correct: false`): Real callers exist. `group_id` = {{diagnosis.classification_hint}}

### Output

Write raw JSON (no markdown fencing) to the output path above:

```
{
  "ariadne_correct": boolean,
  "group_id": "string",
  "root_cause": "string",
  "reasoning": "string"
}
```
