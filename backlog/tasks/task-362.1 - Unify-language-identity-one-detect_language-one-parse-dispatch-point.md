---
id: TASK-362.1
title: "Unify language identity — one detect_language, one parse dispatch point"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - language-axis
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Program Area 1 (`backlog/drafts/ia-review.refactor-program.md`). Effort M,
risk low. Three layer-2 reports independently name this the highest-leverage
single fix. Goes first in the epic: smallest blast radius, and it unblocks
the language-guard cleanups in TASK-362.3 and TASK-362.4.

`detect_language` is defined three times with three different answers to
"what happens on an unknown extension" (all verified):

| Site                                                           | Contract                                               |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `classify_entry_points/extract_entry_point_diagnostics.ts:718` | returns `Language \| null`; handles `.mjs`/`.cjs`      |
| `project/project.ts:60`                                        | **throws** `Unsupported file extension`                |
| `trace_call_graph/trace_call_graph.ts:22`                      | **defaults to `"typescript"`** — a latent mislabel bug |

The canonical copy is buried in an 867-LOC classification megafile, and 14
builtins (`check_*.ts`) import it from there. `project.ts` additionally
embeds the entire parse-phase language dispatch (`get_parser` L81,
`create_parsed_file` L105, all four tree-sitter grammar imports L29–33)
behind an orchestrator name — the worst-discoverability touch point for
adding a language.

### Work

1. Create `packages/core/src/detect_language.ts` from the canonical nullable
   copy: `detect_language(path): Language | null` plus
   `assert_language(path): Language` as the throwing wrapper.
2. Create `project/parse_file.ts`: move `get_parser`, `create_parsed_file`,
   and the four grammar imports out of `project.ts`; it consumes
   `assert_language`. This is the single parse-phase dispatch point.
3. Re-point the 14 builtins and `extract_entry_point_diagnostics.ts` to
   `detect_language.ts`; delete the two private copies. `trace_call_graph.ts`
   uses `assert_language` — unknown extensions upstream of trace are a
   filtering bug and must fail loud, not default.
4. Switch `check_py-dunder-protocol.ts` off its raw `.endsWith(".py")` to the
   shared function.

### Small-item rows owned by this task

- **Row 33** — record the terminal language-mechanism rule in
  `.claude/rules/file-naming.md`: dotted suffix is the default;
  `extractors/`-style prefix sub-folders only for shared-base hierarchies;
  language sub-folders and per-language top-level modules are prohibited;
  `builtins/` uses filename=group_id. Land this as the task's first commit so
  TASK-362.2/.3 apply a decided rule, not a re-litigated one.
- **Row 22** — split the static parser registry
  (`LANGUAGE_TO_TREESITTER_LANG`, `SUPPORTED_LANGUAGES`) out of
  `index_single_file/query_code_tree/query_loader.ts` into `parsers.ts`;
  delete the five stale `semantic_index/queries/` fallback paths. (Parser
  identity belongs with this area; coordinate the file move with TASK-362.2
  if it lands first.)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `grep -rn "function detect_language" packages/core/src` returns exactly
      one definition, in `detect_language.ts`; `assert_language` is the only
      throwing form.
- [ ] `trace_call_graph` throws on an unknown extension (test added); no code
      path silently defaults a file to TypeScript.
- [ ] `project.ts` contains no tree-sitter grammar imports and no parser
      construction; `project/parse_file.ts` owns them.
- [ ] All 14 builtins and `check_py-dunder-protocol.ts` import language
      detection from `detect_language.ts`; no `.endsWith(".py")`-style raw
      extension checks remain in builtins.
- [ ] `file-naming.md` records the terminal dotted-suffix rule (row 33);
      `query_loader.ts` parser registry split landed (row 22).
- [ ] Full core test suite green; no re-exports or aliases left behind.

<!-- AC:END -->
