## Investigation: Wrong Resolution Target

**Diagnosis**: `callers-in-registry-wrong-target` — Ariadne found call references matching this function's name and resolved them, but they resolved to a different symbol. The resolution phase linked the call to the wrong definition.

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

1. **Examine the Ariadne call references** listed above. For each reference:
   - Note the `resolved_to` list — these are the symbols the call resolved to (not this entry)
   - Note the `call_type` — method calls are most prone to wrong-target resolution
   - Compare the resolved targets with the entry under investigation

2. **Read the source at the call sites**:
   - Read the caller file at the call line to understand the invocation
   - Identify the receiver type (for method calls) or the import source (for function calls)
   - Determine which definition the call SHOULD resolve to

3. **Read the resolved-to definitions**:
   - For each symbol in `resolved_to`, find and read its definition
   - Compare it with the entry under investigation at {{entry.file_path}}:{{entry.start_line}}
   - Determine why Ariadne chose the wrong target:
     - Same method name on different classes (class hierarchy confusion)?
     - Function shadowing (local definition shadows imported one)?
     - Overloaded names across modules?
     - Interface vs implementation mismatch?

4. **Read the entry definition**:
   - Read {{entry.file_path}} around line {{entry.start_line}}
   - Understand the class/module context
   - For methods: check the class hierarchy — is this an override, implementation, or base method?

5. **Verify with Ariadne MCP tools**:
   - Use `show_call_graph_neighborhood` with `symbol_ref` = `{{entry.file_path}}:{{entry.start_line}}#{{entry.name}}` and `callers_depth: 2`
   - Check if Ariadne shows callers that should be pointing to this entry but are pointing elsewhere

6. **Identify the wrong-target pattern**:
   - Is this a scope/visibility issue (wrong class method selected)?
   - Is this a class hierarchy issue (base method resolved instead of override, or vice versa)?
   - Is this a module boundary issue (same-name function in different module resolved)?
   - Is this a type narrowing issue (receiver type not specific enough)?

7. **Classify the entry**:
   - If real callers exist but resolved to wrong target → **false-positive** with a group_id describing the mismatch
   - If the resolved targets are actually correct and this entry is not the right target → check for true-positive or dead-code
   - If the function is a legitimate entry point → **true-positive**
   - If the function appears unused → **dead-code**

### Classification Guide

- **true-positive**: `group_id = "true-positive"`, `is_true_positive = true`, `is_likely_dead_code = false`
- **dead-code**: `group_id = "dead-code"`, `is_true_positive = false`, `is_likely_dead_code = true`
- **false-positive**: `group_id` = kebab-case mismatch type (e.g., `"class-hierarchy-dispatch"`, `"interface-impl-mismatch"`, `"module-shadow-resolution"`, `"overloaded-name-collision"`), `is_true_positive = false`, `is_likely_dead_code = false`

### Output

Write raw JSON (no markdown fencing) to the output path above:

```
{
  "is_true_positive": boolean,
  "is_likely_dead_code": boolean,
  "group_id": "string",
  "root_cause": "string",
  "reasoning": "string"
}
```
