---
id: TASK-362.1
title: "Unify language identity — one detect_language, one parse dispatch point"
status: Done
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

### Design: detect at ingress, thread as a parameter

Language is a property of a file computed exactly once, when the file enters
the system, and carried forward as an explicit parameter on every pathway
that needs it. The front half of the pipeline already works this way
(`ParsedFile.lang`, `SemanticIndex.language`, the `languages` map handed to
every resolution phase); the three private copies exist where downstream
code dropped that thread and re-derived language from the path string. The
fix re-attaches the thread rather than giving the re-derivation a shared
home. Path-based detection survives only at ingress points — where a path is
all that exists yet: the parse dispatch, file-discovery filtering, and the
skill-side loader that reads persisted samples back from JSON.

### Work

1. Create `packages/core/src/detect_language.ts`: the single canonical
   `detect_language(path): Language | null` plus
   `assert_language(path): Language` as the throwing wrapper. Its callers
   are ingress sites only.
2. Create `project/parse_file.ts`: move `get_parser`, `create_parsed_file`,
   and the four grammar imports out of `project.ts`; it consumes
   `assert_language` (only supported files may reach the parser —
   unsupported extensions fail loud at ingress). This is the single
   parse-phase dispatch point.
3. Make the languages map first-class ingress state on `Project`: maintained
   incrementally alongside `index_single_filees` (today it is rebuilt from
   all indexes on every `update_file`/`remove_file`) and passed by reference
   to every consumer.
4. Re-attach the dropped threads — delete all three private copies:
   - `trace_call_graph` gains a `languages: ReadonlyMap<FilePath, Language>`
     parameter (the same shape resolution already takes); the lookup cannot
     miss because every definition it sees came from a parsed file.
   - The classifier driver passes the entry point's language into each
     builtin: `BuiltinCheckFn` gains a trailing `language` parameter, and
     all 15 language-gating builtins read it instead of re-detecting from
     `file_path`. `check_py-dunder-protocol.ts` drops its raw
     `.endsWith(".py")` for the same parameter. The three language-agnostic
     checks keep their narrower signature.
   - `extract_entry_point_diagnostics.ts` reads language from the languages
     map where it derives per-language features; its exported
     `detect_language` is deleted.
   - The `classifier-author` agent doc (`.claude/agents/classifier-author.md`)
     templates the builtin signature and the `detect_language` import — it is
     updated in the same change so future drafts match the new contract.
5. Skill-side ingress: the `reconcile_registry.ts` staged-check harness
   computes each sample's language once as the sample is loaded from
   `samples/*.json`, via the canonical `detect_language`, and passes it to
   the check under test.

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
  `parse_file.ts` builds its parsers from this registry so the four grammar
  imports live at one site. (The stale `semantic_index/queries/` fallback
  paths named by the original row were already removed in commit `120482cd`;
  parser identity belongs with this area — coordinate the file move with
  TASK-362.2 if it lands first.)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `grep -rn "function detect_language" packages/core/src` returns exactly
      one definition, in `detect_language.ts`; `assert_language` is the only
      throwing form.
- [ ] No code downstream of parse performs path-based language detection:
      `grep -rn "detect_language(" packages/core/src` matches only ingress
      sites (`parse_file.ts`, file-discovery filtering). `trace_call_graph`
      and the builtins consume language as a parameter; no code path silently
      defaults a file to TypeScript.
- [ ] `Project.update_file` throws on an unsupported extension at the parse
      dispatch (test added); the languages map is maintained incrementally,
      not rebuilt per update.
- [ ] `project.ts` contains no tree-sitter grammar imports and no parser
      construction; `project/parse_file.ts` owns them.
- [ ] `BuiltinCheckFn` takes a trailing `language` parameter; all 15
      language-gating builtins and `check_py-dunder-protocol.ts` read it; no
      `.endsWith(".py")`-style raw extension checks remain in builtins. The
      `reconcile_registry.ts` staged-check harness supplies language at
      sample load, and `.claude/agents/classifier-author.md` templates the
      new signature.
- [ ] `file-naming.md` records the terminal dotted-suffix rule (row 33);
      `query_loader.ts` parser registry split landed (row 22).
- [ ] Full core test suite green; no re-exports or aliases left behind.

<!-- AC:END -->

## Implementation Notes

## High-level summary

A file's language is a fact established exactly once, at the moment the file
enters the system, and carried forward as an explicit parameter. Before this
task, three private `detect_language` copies answered "what language is this
file?" with three different unknown-extension contracts — one of them silently
defaulting to TypeScript inside `trace_call_graph`, a latent mislabel bug —
because downstream code had dropped the language thread the front half of the
pipeline already carries (`ParsedFile.lang`, `SemanticIndex.language`, the
`languages` map handed to every resolution phase).

The change re-attaches that thread rather than giving re-derivation a shared
home. `packages/core/src/detect_language.ts` is the single path-based detector
(`detect_language(path): Language | null`, plus the core-internal throwing
`assert_language`), and its callers are ingress sites only: the parse dispatch,
file-discovery filtering, and the skill-side sample loader that re-enters
persisted JSON. `project/parse_file.ts` owns the parse-phase dispatch, building
parsers from the `parsers.ts` grammar registry (row 22) so the four tree-sitter
grammar imports live at one site. `Project` maintains its `languages` map as
first-class ingress state — set on update/restore, deleted on remove, exposed
via `get_languages()` — instead of rebuilding it from all indexes on every
update. Downstream, `trace_call_graph` receives the map as a parameter (a miss
throws; nothing defaults), `BuiltinCheckFn` carries a trailing `language`
parameter that the classifier driver looks up per entry, and
`extract_entry_point_diagnostics` reads the map where it derives per-language
features.

Navigation: language identity starts at `detect_language.ts`; parsing lives in
`project/parse_file.ts`; the map's lifecycle is the four mutation sites in
`project/project.ts`; the classifier contract is
`classify_entry_points/builtins/index.ts`. A structural guard in
`builtins/field_denylist.test.ts` fails the build if a builtin ever re-derives
language from a path, and `.claude/agents/classifier-author.md` templates the
three-argument check signature so future drafts match.

Sharp edges: the canonical detector is case-sensitive (uppercase extensions
never arrive through discovery, which is also case-sensitive); `.mjs`/`.cjs`
map to JavaScript at ingress, so `update_file` accepts them where the old
parse-phase copy threw; and the fail-loud map lookups convert a
formerly-silent mislabel into a crash, which is the intended contract — worth
one smoke run against a large real project before the next release.
