---
"@ariadnejs/mcp": minor
---

Report true entry points by default, and put the suppressed bucket behind a flag.

`list_entrypoints` sources its output from
`Project.get_classified_entry_points()`, so the default listing an agent reads
holds true entry points only. Framework-invoked routes, Python dunder protocol
methods, dynamically dispatched callables, indirect-only calls and test-only
code no longer appear as functions nothing calls.

Start the server with `--show-suppressed` (or `ARIADNE_SHOW_SUPPRESSED=1`) to
append a clearly-delimited "Suppressed (known false positives)" section, each
entry tagged with the `[group_id: detail]` that matched it. The flag is
server-level rather than a per-call parameter, so a triage workflow enables it
once in `.mcp.json` while everyday agents keep the clean default;
`--no-show-suppressed` overrides the environment variable.

The `ariadne-mcp` binary and the `start_server` export keep their names. The
tool set is unchanged: `list_entrypoints` and `show_call_graph_neighborhood`.
