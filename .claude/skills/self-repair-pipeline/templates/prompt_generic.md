## Investigation: General Entry Point Analysis

**Diagnosis**: `{{entry.diagnosis}}` — No textual callers were found by grep, or this entry did not match a specific diagnosis category. A broad investigation is needed to determine whether Ariadne missed real callers.

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

1. **Read the definition**:

   - Read {{entry.file_path}} around line {{entry.start_line}} to understand the callable
   - Understand its purpose from context, comments, and naming

2. **Search for callers using varied patterns**:

   - For functions: `Grep` for `{{entry.name}}(` excluding the definition file
   - For methods: `Grep` for `.{{entry.name}}(` to catch any receiver
   - For constructors: `Grep` for `new ClassName(` patterns
   - Search for dynamic references: string literals, decorator usage, configuration files
   - Check test files: `Grep` for `{{entry.name}}` in `**/*.test.ts` and `**/*.spec.ts`

3. **Check for indirect invocation patterns**:

   - Is the function passed as a callback? Search for the function name without parentheses
   - Is it registered in a map/object/array? Search in configuration-like structures
   - Is it invoked via reflection or string-based dispatch?
   - Is it a method on a class used via interface/base class typing?

4. **Verify with Ariadne MCP tools**:

   - Use `show_call_graph_neighborhood` with `symbol_ref` = `{{entry.file_path}}:{{entry.start_line}}#{{entry.name}}` and `callers_depth: 2`
   - Use `list_entrypoints` to see if related functions in the same module are also entry points

5. **Classify the entry**:
   - If no real callers exist anywhere in the codebase → `ariadne_correct: true`, `group_id: "confirmed-unreachable"`
   - If real callers exist that Ariadne missed → `ariadne_correct: false`, `group_id` = kebab-case detection gap

### Classification Guide

- **Ariadne correct** (`ariadne_correct: true`): No real callers found. `group_id = "confirmed-unreachable"`.
- **False positive** (`ariadne_correct: false`): Real callers exist that Ariadne missed. `group_id` = kebab-case detection gap (e.g., `"dynamic-dispatch"`, `"callback-registration"`, `"framework-lifecycle"`).

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
