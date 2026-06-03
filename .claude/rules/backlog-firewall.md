# Backlog Firewall — Write-Boundary Contract

The user's `backlog/` directory is the human-owned planning surface. It is firewalled from the self-healing pipeline: the pipeline skills (`triage`, `plan`) are read-only against it. Proposed work flows through the plan engine's own task-DB (`~/.ariadne/plan/`); a single human-invoked export adapter is the sole programmatic bridge from that DB into `backlog/`. This mirrors the registry write-boundary contract (`.claude/rules/classifier-lifecycle.md`): one named writer per transition, an auditable surface, structural enforcement.

The boundary is one-directional by design: the pipeline runs autonomously and `backlog/` is the human's task tracker, so an unattended run must not reorder, file, or close the user's work. The boundary is enforced two ways — a writer table that names who may touch `backlog/`, and an AST test that fails the build if pipeline code crosses it.

## Writers

| Writer                                                                       | Writes                                                                                                          | Trigger                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **triage**                                                                   | **never writes** `backlog/`; **never calls** a mutating `mcp__backlog__*` tool                                  | n/a                                      |
| **plan**                                                                     | **never writes** `backlog/`; **never calls** a mutating `mcp__backlog__*` tool (planning-only; renders proposed work as `PlanTask` rows into `~/.ariadne/plan/`) | n/a                                      |
| **export adapter** (`.claude/skills/plan/scripts/export_to_backlog.ts`, TASK-190.22.11) | the **sole** programmatic writer of `backlog/` — promotes a DB task into a `backlog/` task file                 | human-invoked, never on the pipeline path |
| **Human (direct)**                                                           | operates `backlog/` directly — the editor, and the `mcp__backlog__*` mutating tools driven by hand             | manual                                   |

Read-only backlog access is permitted in any pipeline code as a dedup signal (TASK-190.22.10): a script may call `task_search`/`task_view`/`task_list`, the `document_view`/`document_list`/`document_search` readers, `milestone_list`, `definition_of_done_defaults_get`, the `get_*_guide`/`get_workflow_overview` discovery tools, and may parse `backlog/` frontmatter directly. Reading the user's backlog to avoid re-proposing work the human already tracks is the intended use.

The mutating tools — gated to the human and the export adapter — are `task_create`, `task_edit`, `task_complete`, `task_archive`, `milestone_add`, `milestone_archive`, `milestone_remove`, `milestone_rename`, `document_create`, `document_update`, and `definition_of_done_defaults_upsert`. The rule is deny-by-default: any `mcp__backlog__*` tool not on the read-only list above is treated as mutating, so a tool added to the backlog MCP server in the future is gated automatically.

## Enforcement

Structural enforcement lives in `packages/skill-fs/src/backlog_writers.test.ts` — the twin of `registry_writers.test.ts`. It walks every `.ts` file under `.claude/skills/**` and `packages/**` (excluding `.test.ts`), parses each with the TypeScript compiler, and flags two violation kinds:

- **raw-write** — a call to a write primitive (`writeFile`/`atomic_write_file`/`appendFile`, the destructive `rename`/`rm`/`unlink`/`mkdir`/`cp`/`copyFile`/`truncate`, and `createWriteStream`) whose path argument resolves to a `backlog/`-shaped path. Resolution is syntactic and same-file: string and template literals, `path.join`/`path.resolve` segment reconstruction, `+` concatenation, and local `const` initializers. Move/copy primitives are checked at the endpoint they write.
- **mutating-tool** — any string-literal-like node naming an `mcp__backlog__<name>` tool whose `<name>` is not on the read-only allowlist. Tool names reach the runtime as prompt and grant strings an agent could be told to call, so naming a mutator in pipeline code is itself the violation.

`ALLOWED_BACKLOG_WRITERS = { ".claude/skills/plan/scripts/export_to_backlog.ts" }` is the sole exception, gating both kinds — the export adapter writes `backlog/` by whatever means it chooses (raw filesystem write or a mutating MCP call), and only it may. Adding a new permitted site requires both an allowlist entry in the test and an update to this doc. A new read-only tool goes in `READ_ONLY_BACKLOG_TOOLS` instead.

The export adapter is named in the allowlist pre-emptively; the file lands with TASK-190.22.11, exactly as `registry_writers.test.ts` pre-allows the fix-sequencer reconciler before its scaffolding exists.

## Known limitations

The test stops accidental and direct backlog writes from pipeline TypeScript. It is a static, per-file, syntactic scan, so the following vectors are out of its reach and must be guarded by review. Their common shape: the test enforces only that pipeline `.ts` does not *write* a backlog path or *name* a mutating tool in a string literal — it cannot see runtime calls, nor the grant surfaces that decide which tools an agent may call.

- **Agent grant surfaces.** The primary breach vector. The pipeline skills run agents whose tool grants live in markdown the `.ts` scan never sees — the `allowed-tools` line of `triage`/`plan` `SKILL.md`, and the `mcpServers:` / `tools:` front-matter of any sub-agent they dispatch (e.g. `.claude/agents/plan-strategist.md`). A mutating `mcp__backlog__*` tool granted there lets an agent mutate the backlog with no pipeline TypeScript involved. **No `allowed-tools` line and no sub-agent grant on the `triage`/`plan` path may admit a mutating `mcp__backlog__*` tool, nor a whole-server `mcpServers: - backlog` grant** (which admits every mutator). Today `plan` `SKILL.md` grants no `mcp__backlog__*` tool at all, and `plan-strategist` carries no `backlog` grant — the plan-engine rewrite (TASK-190.22.9) dropped the whole-server `backlog` grant left over from the pre-restructure curator (the agent now reads only the staged fault-area bucket and writes its plan under `~/.ariadne/plan/staging/**`). `agent_prompt_pin.test.ts` pins `mcp_servers: []` to guard against regression.
- **Shell-out.** A script that shells out (`execSync`, `child_process`, a `Bash(...)` invocation) with a redirect into `backlog/` is opaque to the static scan.
- **Cross-module path helpers and dynamic names.** The scan resolves a write target only within the same file. A `backlog/` path imported from another module, or a tool name assembled at runtime (`"mcp__backlog__" + verb`, a `${verb}` interpolation), is not chased — a deliberate scoping decision shared with the registry twin. The same applies to `fs.open` with a write flag (its read/write intent is decided by a later argument) and to a detached `createWriteStream` handle whose `.write()` is called separately.

## Cross-references

- `.claude/rules/classifier-lifecycle.md` — the registry write-boundary contract this firewall is modeled on.
- `.claude/rules/commit-convention.md` — the export adapter's `backlog/` task ids must follow the convention so the fix-sequencer can parse them.
- `.claude/skills/plan/SKILL.md` — the plan engine's planning-only role and its read-only relationship to `backlog/`.
