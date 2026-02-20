## Investigation: Resolution Failure

**Diagnosis**: `callers-in-registry-unresolved` — Ariadne's file registry contains files with call references matching this function's name, but the resolution phase failed to resolve them to this definition. The calls are indexed but not linked.

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
   - Note the `resolution_count` — if 0, the call was detected but resolution produced no targets
   - Note the `resolved_to` list — if empty, the reference is unresolved
   - Note the `call_type` — method calls, function calls, and constructor calls use different resolution strategies

2. **Read the source code at the call sites**:
   - Read the caller file at the call line to understand the invocation pattern
   - Identify the receiver expression (for method calls) or import path (for function calls)
   - Check if the call uses patterns that complicate resolution:
     - Aliased imports (`import { foo as bar }`)
     - Destructured assignments (`const { method } = object`)
     - Re-exports through barrel files (`export { foo } from './module'`)
     - Generic type parameters affecting method dispatch
     - Prototype chain or mixin patterns

3. **Read the definition site**:
   - Read {{entry.file_path}} around line {{entry.start_line}}
   - Check how the function is defined and exported
   - For methods: check the class hierarchy and whether the method is inherited or overridden

4. **Verify with Ariadne MCP tools**:
   - Use `show_call_graph_neighborhood` with `symbol_ref` = `{{entry.file_path}}:{{entry.start_line}}#{{entry.name}}` and `callers_depth: 2`
   - Compare Ariadne's view (0 callers) with the grep evidence (callers exist)

5. **Identify the resolution failure pattern**:
   - Is this a name resolution failure (Ariadne cannot find the symbol by name)?
   - Is this a scope resolution failure (Ariadne finds the name but in the wrong scope)?
   - Is this a type resolution failure (method call on an untyped or dynamically-typed receiver)?
   - Is this an import resolution failure (import path not followed correctly)?

6. **Classify the entry**:
   - If real callers exist and resolution genuinely failed → **false-positive** with a group_id describing the resolution gap
   - If the unresolved references are not actually calling this function (name collision) → continue checking for true-positive or dead-code
   - If the function is a legitimate entry point → **true-positive**
   - If the function appears unused → **dead-code**

### Classification Guide

- **true-positive**: `group_id = "true-positive"`, `is_true_positive = true`, `is_likely_dead_code = false`
- **dead-code**: `group_id = "dead-code"`, `is_true_positive = false`, `is_likely_dead_code = true`
- **false-positive**: `group_id` = kebab-case resolution gap (e.g., `"aliased-import-resolution"`, `"barrel-reexport"`, `"prototype-method-dispatch"`, `"generic-type-erasure"`), `is_true_positive = false`, `is_likely_dead_code = false`

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
