---
"@ariadnejs/core": major
"@ariadnejs/types": major
---

Move known-false-positive classification into core.

`Project.get_call_graph().entry_points` now returns true positives only by
default — entry points that match a bundled known-issue rule (Flask routes,
pytest fixtures, Python dunders, dynamic dispatch, JSX components, etc.) are
filtered out.

For triage workflows that need to see the suppressed bucket, use the new
`Project.get_classified_entry_points()` API which returns
`{ true_entry_points, known_false_positives }`. Each
`ClassifiedEntryPoint.classification` carries a discriminated-union verdict
(`true_entry_point | framework_invoked | dunder_protocol | test_only |
indirect_only`) plus the matching rule's `group_id`.

The MCP `list_entrypoints` tool gains a server-level `--show-suppressed` flag
(env: `ARIADNE_SHOW_SUPPRESSED`) that appends a clearly-delimited "Suppressed
(known false positives)" section to default output. Configure it once via
`.mcp.json` for triage workflows; everyday agents see the clean default.

`@ariadnejs/types` bumps in lockstep with `@ariadnejs/core` (linked release).
The new types are: `ClassifiedEntryPoint`, `ClassifiedEntryPoints`,
`EntryPointClassification`, `ClassifierHint`, `KnownIssue`,
`KnownIssuesRegistry`, `KnownIssuesRegistryFile`, `PredicateExpr`,
`ClassifierSpec`, `KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION`. The skill type
`EnrichedFunctionEntry` is renamed `EnrichedEntryPoint`.

## Persisted-state preservation policy

If you run the self-healing pipeline locally, **do not** delete
`~/.ariadne/self-repair-pipeline/analysis_output/`. That directory is the
permanent source of truth for the per-project TP cache; wiping it kills
cross-run TP reuse and forces every previously-confirmed entry point back
through the LLM investigator.

Upgrade steps for projects with pre-run-namespaced state:

- Stale "active" runs: clear the `LATEST` pointer with
  `.claude/skills/self-repair-pipeline/scripts/abandon_run.ts` or by deleting
  the `LATEST` file.
- Pre-run-namespaced state: run
  `.claude/skills/self-repair-pipeline/scripts/migrate_legacy_state.ts --project <name>`
  (or `--purge` to drop history).

The persistence-cache schema version (`packages/core/src/persistence/cache_manifest.ts`)
bumps from 1 → 2; pre-bump caches in `~/.ariadne/cache/<slug>/manifest.json`
auto-invalidate on first read after upgrade.
