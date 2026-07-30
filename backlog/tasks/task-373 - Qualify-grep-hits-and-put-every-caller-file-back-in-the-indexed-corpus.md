---
id: TASK-373
title: "Qualify grep hits and put every caller file back in the indexed corpus"
status: To Do
assignee: []
created_date: "2026-07-29 09:36"
labels:
  - plan-export
  - entry_point_classification
  - coverage_config
dependencies: []
priority: high
plan_dedup_keys:
  - cc6daf01eb582644b4a7ec62fdca8b8884fb435c37422794216bea9366c7509b
  - 0e2e65174f0efe114712f99544a0ed31dae5fe34b6db4e86a07ee3d6bf893dca
plan_source_tasks:
  - pt-39e53c1dfe2f9183
  - pt-ed315a9bde140696
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

"Is this callable an entry point?" is answered from `EntryPointDiagnostics`, and that record is narrowed twice on the way in while its single evidence channel counts non-calls as calls.

1. **Scope is applied at discovery instead of at candidacy.** The candidate tier already exists and works: `trace_call_graph` marks every callable in a test file `is_test` (`trace_call_graph.ts:49-51`) and drops those from the entry-point set unless `include_tests` is set (`:89-91`). The triage harness applies the _same_ predicate a second time as a `load_project` `file_filter`, which shrinks the set of files `update_file` is ever called on (`load_project.ts:121-124`). The second application is pure loss — it deletes the file's _references_ along with its candidacy. Measured on a temp fixture: filtered at discovery yields entry points `['pool_shrink', 'unused_one']`, the full corpus yields `['unused_one']`; the TypeScript twin yields an empty set. The predicate removed from discovery (`!is_test_file(file, detect_language(file))`) is byte-for-byte the predicate that sets `node.is_test` (`trace_call_graph.ts:50`), so every file that re-enters the corpus contributes edges and zero candidates.
2. **The corpus filter matches unanchored substrings.** `should_ignore_path` (`project/file_loading.ts:73-99`) tests `relative_path.includes(ignore)` for every entry of `IGNORED_DIRECTORIES` (`:12-25`), so `"temp"` excludes `packages/compiler/src/render3/r3_template_transform.ts` and `packages/compiler/src/template/**`, `"build"` excludes `src/compiler/tsbuildPublic.ts`, and `"dist"` excludes `packages/common/locales/generate-locales-tool/bin/write-locale-files-to-dist.ts` — every caller file of four Angular symbols and of TypeScript's `getAllProjectOutputs` / `getFirstProjectOutput`, while every callee file is indexed.
3. **A definition line counts as a call site, and so does a comment.** `build_grep_index` is a bare `identifier\s*\(` regex over the corpus (`extract_entry_point_diagnostics.ts:309-347`, pattern at `:316`) and `grep_for_calls` filters out only the entry's _own_ definition line (`:441`). So a sibling override's declaration is a "caller": `AuroraMysqlQueryRunner.ts:382 "async dropSchema(...)"`, `celery/worker/control.py:559 "def pool_shrink(...)"`, `django/db/models/query.py:1427 "async def aupdate(...)"`, and even `tokio/src/io/async_fd.rs:127 "/// let unfilled = buf.initialize_unfilled();"`. Those phantom hits set `has_uncaptured_indexed_grep_hit: true` (`:409-411`), force `compute_diagnosis` to `callers-not-in-registry` (`:512-525`), veto the coverage signal (`attach_unindexed_test_grep_hits.ts:127-128`) and mis-route ~15 members to `syntactic_extraction` (`ariadne_fault_area.ts:283-290`).

This task is the load-bearing core of the epic: complete the corpus, and make the hits honest so every later measurement — in this epic and in every other — is read against true diagnostics. Sub-tasks 1.1-1.3 follow it in order.

## Work plan

1. **Qualify grep hits** in `packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts`. The function already holds `project.definitions` (`:112`): build a `Set<string>` of `` `${file_path}:${start_line}` `` over `definitions.get_callable_definitions()` — the same source `trace_call_graph.ts:26` uses — thread it into `gather_diagnostics`, and in `grep_for_calls` (`:423-447`) replace the single-line self-exclusion at `:441` with a lookup in that set: a hit landing on **any** callable definition's start line is a declaration, not a call. Exact and language-agnostic; no `def `/`function ` regex.
2. **Drop comment-line hits.** `hit.content` is already `line.trim()` (`:336`) and the language is available from `project.get_languages()`; reject a hit whose content starts with the language's line-comment marker (`//`, `///`, `#`) or a block-comment continuation (`*`, `/*`). Leave `MAX_GREP_HITS` (`:349`) and the constructor `class_def_pattern` (`:435-437`) as they are — the class regex still covers `class Name(Base):` lines, which are not constructor start lines.
3. **Delete `file_filter` from `packages/core/src/project/load_project.ts`** — the option (`:33-34`), its destructure (`:70`) and its application (`:121-124`); `final_files` becomes `files_to_load`. The only in-repo callers are the two triage scripts handled in sub-task 1.1, so this leaves no orphan. This is the edit that puts the callers back in the corpus.
4. **Have `load_project` return the dropped-file set.** `:207-216` catches a per-file indexing error, `console.warn`s and continues, so a whole file can leave the corpus with no structured trace (express `lib/response.js` is dropped whole with `Duplicate export name "res"` from `resolve_references/registries/export.ts:150`). Return the set so the run can report it honestly and sub-task 1.2 can grep it.
5. **Anchor `should_ignore_path`** in `packages/core/src/project/file_loading.ts:73-99` on **path segments**: split `relative_path` on `/` and test segment equality against `IGNORED_DIRECTORIES` (`:12-25`), keeping the existing `.DS_Store` and gitignore handling. Ship it as its own commit — it is independently valuable and independently testable.
6. **Add the unit-level pins.** In `trace_call_graph.test.ts`, beside the existing `include_tests` case at `:511-516`: a test-file callable calling a production callable yields entry points `[]` under `include_tests: false` and `[test_fn]` under `include_tests: true` — this pins candidate-set invariance, the property the whole epic rests on. In `file_loading.test.ts`: `src/compiler/tsbuildPublic.ts`, `packages/compiler/src/render3/r3_template_transform.ts`, `packages/compiler/src/template/pipeline/x.ts` and `tools/write-locale-files-to-dist.ts` are **not** ignored, while `node_modules/x/y.ts`, `dist/main.js`, `build/out.js`, `temp/a.ts` and `packages/x/fixtures/y.ts` still are.
7. **Add integration tests covering every evidence case in this group's triage evidence.** In `extract_entry_point_diagnostics.test.ts`, over a real `Project`: a project with two same-named methods on unrelated classes where the entry's only grep hits are (a) the sibling's declaration line and (b) a doc comment asserts `grep_call_sites: []`, `diagnosis: "no-textual-callers"`, `has_uncaptured_indexed_grep_hit: false`, plus a negative control where a real call on the same name is still captured. Reproduce each declaration/comment shape in the evidence: typeorm's six driver overrides (`dropSchema`, `hasSchema`, `createDatabase`, `dropPrimaryKey`, `dropTable`, `renameTable`, the `AuroraMysqlQueryRunner.ts:382` shape), celery `pool_shrink`, `pool_grow`, `autoscale`, `add_consumer` (`def name(...)` at `control.py:559`), django `aupdate` and `as_text` (`async def`), and the tokio `unfilled` Rust doc-comment hit (`async_fd.rs:127`). In `load_project.test.ts`, with real files on disk (Python needs `__init__.py` markers — an in-memory `update_file` pair does not exercise import resolution and yields a misleading negative): the prisma `compileFile` shape (plain import and call from `src/__tests__/**`) and the celery `long_running_task` shape (`t/smoke/tasks.py` called as `long_running_task.si(5)` from `t/smoke/tests/test_worker.py`, plus a filename-marked `t/unit/app/test_control.py` caller outside any test directory) each assert the callee is absent from the entry-point set and the test function is too. Add fixture files for the `should_ignore_path` cases so the eight Angular/TypeScript rows are covered by a fixture whose caller lives under a `template`/`tsbuild`/`-to-dist` path.
8. **Keep the insulated tests green**: `project/load_project.test.ts`, `project/project.{typescript,javascript,python,rust}.integration.test.ts` (the `include_tests: true` assertions at `project.typescript.integration.test.ts:1415,1512,1565` and siblings), `trace_call_graph.test.ts`, `classify_entry_points/enrich_call_graph.test.ts:204`, `auto_classify*.test.ts`, `builtins/field_denylist.test.ts`, `registry_permanent_data.sync.test.ts`, `project/detect_test_file.test.ts` and `test_dir_patterns.test.ts` (this epic removes the _duplicate_ definition of "test file", not the owner), and the `packages/types` fault-area derivation tests.

## Rows carried here but deliberately not implemented

- **Angular component templates** (`pt-ef2a6827b9233c37`) are re-tiered out. Admitting `.html`, mapping it to TypeScript, blanking everything outside binding expressions position-preservingly and binding a template's references into its component class through the `@Component` `templateUrl` literal follows the `.mdx` precedent (`file_loading.ts:7`, `detect_language.ts:16-23`, `parse_file.ts:34-36`, `blank_mdx_frontmatter.ts`) and is unlocked by nothing here. It graduates as its own architectural root. The django `contents` row is a permanent limitation: `{{ field.contents }}` carries no call syntax, `field` is bound by three nested `{% for %}` loops over dynamically built lists, and `Variable._resolve_lookup` invokes any callable attribute at render time — route that member to `classifier-author`.
- **Walk sibling workspace members** (`pt-83cfa75772d15487`) is deleted; its premise is false. `find_source_files` is a _recursive_ walk (`file_loading.ts:124-165`) rooted at the repo root, 44 distinct `tokio-util/src/**` paths appear in the run output including the cited file, and its call site is already in `grep_call_sites` — built only from the indexed corpus. `captures: []` with `ariadne_call_refs: []` is a resolution miss inside an indexed file (a call on a parameter typed `&mut tokio::io::ReadBuf<'_>` inside `impl<T> tokio::io::AsyncRead for Compat<T>`); the row is re-routed to `type-model-completion`.

## Expected fallout, not regression

With test call sites in the corpus, many entries move from `callers-not-in-registry` to `callers-in-registry-wrong-target` (`:529-544`) and route to `entry_point_classification` — the resolver now genuinely sees the call and picks the wrong target. Sixteen rows (typeorm x6, celery x8 through `app.control` / `Control.inspect` cached-property factories, django `aupdate` and `as_text`) become measurable with a _different, now visible_ fault; they are not re-planned here. Re-run triage and let them re-bucket.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A hit landing on any callable definition's start line is excluded from `grep_call_sites`, verified by an integration test over a real `Project` for the typeorm override shape (`async dropSchema(...)` on a sibling class), the celery `def pool_shrink(...)` shape and the django `async def aupdate(...)` shape.
- [ ] #2 A hit whose trimmed content starts with a line-comment marker or block-comment continuation is excluded, verified for the Rust doc-comment case `/// let unfilled = buf.initialize_unfilled();`.
- [ ] #3 Negative control: a genuine `name(` call on the same identifier is still captured, and `has_uncaptured_indexed_grep_hit` still becomes true for it.
- [ ] #4 celery `pool_shrink`, `pool_grow`, `autoscale`, `add_consumer`, typeorm's six driver overrides (`dropSchema`, `hasSchema`, `createDatabase`, `dropPrimaryKey`, `dropTable`, `renameTable`) and django `aupdate`, `as_text` carry `grep_call_sites: []`, `diagnosis: "no-textual-callers"` and `has_uncaptured_indexed_grep_hit: false` on the live pipeline; none of them routes to `syntactic_extraction`.
- [ ] #5 `LoadProjectOptions` no longer has `file_filter`, and `load_project` returns the set of files it dropped on an indexing error (reproduced with express `lib/response.js` / `Duplicate export name "res"`).
- [ ] #6 `should_ignore_path` matches whole path segments: `src/compiler/tsbuildPublic.ts`, `packages/compiler/src/render3/r3_template_transform.ts`, `packages/compiler/src/template/pipeline/x.ts` and `tools/write-locale-files-to-dist.ts` are indexed, while `node_modules/x/y.ts`, `dist/main.js`, `build/out.js`, `temp/a.ts` and `packages/x/fixtures/y.ts` are still ignored.
- [ ] #7 `trace_call_graph.test.ts` pins candidate-set invariance: a test-file callable calling a production callable yields `[]` under `include_tests: false` and `[test_fn]` under `include_tests: true`.
- [ ] #8 Integration tests with on-disk fixtures cover every evidence case in this group: prisma `compileFile` (caller in `src/__tests__/**`), celery `long_running_task` (`t/smoke/tasks.py` called via `.si(5)` from `t/smoke/tests/test_worker.py`), a celery-shaped filename-marked caller outside any test directory (`t/unit/app/test_control.py`), the typeorm/celery/django declaration-line hits, the tokio doc-comment hit, and the eight Angular/TypeScript `should_ignore_path` rows.
- [ ] #9 prisma `compileFile` and celery `long_running_task` are no longer reported as entry points, and no new entry point appears from a test file under `include_tests: false`.
- [ ] #10 Every insulated test named in the work plan stays green, including the `include_tests: true` assertions in the language integration suites and `project/detect_test_file.test.ts` / `test_dir_patterns.test.ts` unchanged.

<!-- AC:END -->
