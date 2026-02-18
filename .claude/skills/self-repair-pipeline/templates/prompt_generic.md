## Investigation: General Entry Point Analysis

**Diagnosis**: `{{entry.diagnosis}}` — No textual callers were found by grep, or this entry did not match a specific diagnosis category. A broad investigation is needed to determine the nature of this callable.

### Entry Under Investigation

- **Name**: {{entry.name}}
- **Kind**: {{entry.kind}}
- **File**: {{entry.file_path}}:{{entry.start_line}}
- **Signature**: {{entry.signature}}
- **Exported**: {{entry.is_exported}}
- **Access modifier**: {{entry.access_modifier}}

### Pre-Gathered Evidence

**Textual call sites (grep results):**
{{entry.diagnostics.grep_call_sites_formatted}}

**Ariadne call references:**
{{entry.diagnostics.ariadne_call_refs_formatted}}

### Investigation Steps

1. **Read the definition**:
   - Read {{entry.file_path}} around line {{entry.start_line}} to understand the callable
   - Understand its purpose from context, comments, and naming
   - Check its module context — what file is it in, what does the module do?

2. **Check if this is a legitimate entry point**:
   - Is it exported from a package entry point (`index.ts`, `package.json` main/exports)?
   - Is it a framework hook or lifecycle method (e.g., React component, Express handler, test function)?
   - Is it a CLI command handler or script entry?
   - Is it an event handler or callback registered with an external system?
   - Is it a public API method on an exported class?

3. **Search for callers using varied patterns**:
   - For functions: `Grep` for `{{entry.name}}(` excluding the definition file
   - For methods: `Grep` for `.{{entry.name}}(` to catch any receiver
   - For constructors: `Grep` for `new ClassName(` patterns
   - Search for dynamic references: string literals containing the name, decorator usage, configuration files
   - Check test files: `Grep` for `{{entry.name}}` in `**/*.test.ts` and `**/*.spec.ts`

4. **Check for indirect invocation patterns**:
   - Is the function passed as a callback? Search for the function name without parentheses
   - Is it registered in a map/object/array? Search for the name in configuration-like structures
   - Is it invoked via reflection or string-based dispatch?
   - Is it a method on a class that gets instantiated and used via interface/base class typing?

5. **Verify with Ariadne MCP tools**:
   - Use `show_call_graph_neighborhood` with `symbol_ref` = `{{entry.file_path}}:{{entry.start_line}}#{{entry.name}}` and `callers_depth: 2`
   - Use `list_entrypoints` to see if related functions in the same module are also entry points (suggesting a broader pattern)

6. **Classify the entry**:
   - If it is a legitimate entry point (public API, framework hook, CLI handler, etc.) → **true-positive**
   - If no callers found and it appears unused/abandoned (no recent changes, no clear purpose) → **dead-code**
   - If callers exist through indirect patterns Ariadne cannot track → **false-positive**

### Classification Guide

- **true-positive**: `group_id = "true-positive"`, `is_true_positive = true`, `is_likely_dead_code = false`
- **dead-code**: `group_id = "dead-code"`, `is_true_positive = false`, `is_likely_dead_code = true`
- **false-positive**: `group_id` = kebab-case detection gap (e.g., `"dynamic-dispatch"`, `"callback-registration"`, `"string-based-invocation"`, `"framework-lifecycle"`), `is_true_positive = false`, `is_likely_dead_code = false`

### Output

Return raw JSON (no markdown fencing):

```
{
  "is_true_positive": boolean,
  "is_likely_dead_code": boolean,
  "group_id": "string",
  "root_cause": "string",
  "reasoning": "string"
}
```
