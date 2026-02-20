## Investigation: Callers Not in Registry

**Diagnosis**: `callers-not-in-registry` — Textual grep found call sites for this function, but the calling files are not in Ariadne's file registry. The calls exist in the codebase but Ariadne never indexed the files containing them.

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

1. **Examine the grep call sites** listed above. For each hit:
   - Read the file at the call site to confirm it is an actual invocation (not a comment, string, or name collision)
   - Note the file path — is it a test file, config file, script, or source file?

2. **Check if calling files are in the project scope**:
   - Use `Glob` to verify the calling files exist in the repository
   - Check if the calling files are in directories that Ariadne excludes (e.g., `node_modules/`, `dist/`, `build/`, `.git/`)
   - Check if the calling files use a supported language/extension

3. **Determine why the calling files were not indexed**:
   - Are they in an excluded folder pattern?
   - Are they a file type Ariadne does not index (e.g., `.json`, `.yaml`, `.html`, `.vue` template section)?
   - Are they generated files in an output directory?
   - Are they in a separate package/workspace that was not included in the analysis scope?

4. **Verify with Ariadne MCP tools**:
   - Use `show_call_graph_neighborhood` with `symbol_ref` = `{{entry.file_path}}:{{entry.start_line}}#{{entry.name}}` and `callers_depth: 2` to check if Ariadne sees any callers
   - If no callers appear, this confirms the registry gap

5. **Classify the entry**:
   - If real callers exist in unindexed files → **false-positive** (Ariadne has a file coverage gap)
   - If the grep hits are all false matches (comments, strings, different functions with the same name) → continue to check if it is a true-positive or dead-code
   - If no real callers exist and the function is a public API, framework hook, or CLI handler → **true-positive**
   - If no real callers exist and the function appears unused → **dead-code**

### Classification Guide

- **true-positive**: `group_id = "true-positive"`, `is_true_positive = true`, `is_likely_dead_code = false`
- **dead-code**: `group_id = "dead-code"`, `is_true_positive = false`, `is_likely_dead_code = true`
- **false-positive**: `group_id` = kebab-case detection gap (e.g., `"unindexed-test-files"`, `"cross-package-call"`, `"template-file-call"`), `is_true_positive = false`, `is_likely_dead_code = false`

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
