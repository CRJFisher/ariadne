---
id: TASK-373
title: "Qualify grep hits and put every caller file back in the indexed corpus"
status: In Progress
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

- [x] #1 A hit landing on any callable definition's start line is excluded from `grep_call_sites`, verified by an integration test over a real `Project` for the typeorm override shape (`async dropSchema(...)` on a sibling class), the celery `def pool_shrink(...)` shape and the django `async def aupdate(...)` shape.
- [x] #2 A hit whose trimmed content starts with a line-comment marker or block-comment continuation is excluded, verified for the Rust doc-comment case `/// let unfilled = buf.initialize_unfilled();`.
- [x] #3 Negative control: a genuine `name(` call on the same identifier is still captured, and `has_uncaptured_indexed_grep_hit` still becomes true for it.
- [ ] #4 celery `pool_shrink`, `pool_grow`, `autoscale`, `add_consumer`, typeorm's six driver overrides (`dropSchema`, `hasSchema`, `createDatabase`, `dropPrimaryKey`, `dropTable`, `renameTable`) and django `aupdate`, `as_text` carry `grep_call_sites: []`, `diagnosis: "no-textual-callers"` and `has_uncaptured_indexed_grep_hit: false` on the live pipeline; none of them routes to `syntactic_extraction`.
- [x] #5 `LoadProjectOptions` no longer has `file_filter`, and `load_project` returns the set of files it dropped on an indexing error (reproduced with express `lib/response.js` / `Duplicate export name "res"`).
- [x] #6 `should_ignore_path` matches whole path segments: `src/compiler/tsbuildPublic.ts`, `packages/compiler/src/render3/r3_template_transform.ts`, `packages/compiler/src/template/pipeline/x.ts` and `tools/write-locale-files-to-dist.ts` are indexed, while `node_modules/x/y.ts`, `dist/main.js`, `build/out.js`, `temp/a.ts` and `packages/x/fixtures/y.ts` are still ignored.
- [x] #7 `trace_call_graph.test.ts` pins candidate-set invariance: a test-file callable calling a production callable yields `[]` under `include_tests: false` and `[test_fn]` under `include_tests: true`.
- [x] #8 Integration tests with on-disk fixtures cover every evidence case in this group: prisma `compileFile` (caller in `src/__tests__/**`), celery `long_running_task` (`t/smoke/tasks.py` called via `.si(5)` from `t/smoke/tests/test_worker.py`), a celery-shaped filename-marked caller outside any test directory (`t/unit/app/test_control.py`), the typeorm/celery/django declaration-line hits, the tokio doc-comment hit, and the eight Angular/TypeScript `should_ignore_path` rows.
- [x] #9 prisma `compileFile` and celery `long_running_task` are no longer reported as entry points, and no new entry point appears from a test file under `include_tests: false`.
- [x] #10 Every insulated test named in the work plan stays green, including the `include_tests: true` assertions in the language integration suites and `project/detect_test_file.test.ts` / `test_dir_patterns.test.ts` unchanged.

<!-- AC:END -->

## Implementation Notes

### What a user gets

Evidence about "who calls this callable?" is now honest on both sides of the question.

- **A mention is no longer a caller.** A `name(` occurrence inside a comment, a docstring or a string literal never becomes a call site, and a line that declares a callable of that name is read as the declaration it is. Entries whose only "callers" were a sibling override's `def` line or a doc comment now report `no-textual-callers` and stop being routed to `syntactic_extraction` on false evidence.
- **A caller file is no longer deleted before it can be seen.** Test files, and files whose path merely contains an ignored directory name (`src/template/**`, `tsbuildPublic.ts`, `…-to-dist.ts`), stay in the corpus and contribute their call edges. Scope is decided at candidacy (`include_tests`), never at discovery.
- **A file the indexer cannot handle is reported rather than half-present.** `load_project` names the files it dropped, and rolls their partial registry state back so they contribute neither phantom entry points nor phantom uncaptured hits.

Measured on the live pipeline: celery `long_running_task` and prisma `compileFile` are gone from the entry-point set, and the phantom `def pool_shrink(...)` declaration hit at `celery/worker/control.py:559` is gone.

### Deviations from the work plan, and why

1. **The declaration key includes the callable's name** (`file:line:name`), where step 1 specified `file:line`. A position-only key deletes genuine calls that share a line with an unrelated definition — `const f = () => g();`, `app.get("/x", (req, res) => send(res))` — trading a phantom caller for a lost one. Every declaration shape in the evidence declares the same name, so the narrower key rejects all of them. Pinned by a test that fails under the position-only key.
2. **Comment detection is range-based, not prefix-based.** Step 2 specified rejecting a trimmed line that starts with a comment marker, including a bare `*`. A leading `*` is a Rust deref and a JS multiplication continuation: on `tokio-rs--tokio` alone, 71 `*`-leading lines carry a call, and prefix matching deleted every one. `qualify_grep_hits.ts` instead scans each file once, carrying block-comment and docstring state across lines, so `/// let unfilled = …` and a JSDoc continuation are rejected while `*c.borrow_mut()` and code after a closed `/* … */` survive. The same scan covers Python docstrings and doctest lines, which prefix matching missed entirely.
3. **`should_ignore_path` needed both of its matchers anchored.** Anchoring only the `IGNORED_DIRECTORIES` scan left the fix unreachable in production: the triage scripts pass `IGNORED_DIRECTORIES` through `load_project`'s `exclude`, which lands in the gitignore pattern branch, and the substring test there still excluded `packages/compiler/src/template/**`. Both branches now match whole path segments, pinned by a test that passes the pattern list the pipeline actually uses.
4. **`should_ignore_path` did not ship as its own commit** (step 5 asked for it). It landed with the corpus change; the anchoring fix that completes it is a separate commit.

### AC #4 is superseded by this task's own "Expected fallout"

AC #4 asks that the twelve named rows carry `grep_call_sites: []` and `no-textual-callers`. That cannot hold once step 3 lands, and the task says so in "Expected fallout, not regression": with the corpus complete, those rows acquire *real* call sites. Measured:

- **celery** `pool_shrink`, `pool_grow`, `autoscale`, `add_consumer` — the phantom declaration hits are gone; what remains are genuine calls in `t/unit/app/test_control.py` (`self.app.control.pool_shrink(2)`), each producing a real `@reference.call` that fails to resolve with `method_not_on_type`. `has_uncaptured_indexed_grep_hit: false`; routes to `receiver_type_inference`, not `syntactic_extraction`.
- **django** `aupdate`, `as_text` — same shape, `has_uncaptured_indexed_grep_hit: false`.
- **typeorm**'s six driver overrides — still `callers-not-in-registry` with `has_uncaptured_indexed_grep_hit: true`, so they still route to `syntactic_extraction`. The evidence is now true rather than phantom: the surviving hits are genuine calls in `test/functional/query-runner/**` that Ariadne fails to capture.

The substantive half of AC #4 (no row routes to `syntactic_extraction` on phantom evidence) holds for celery and django. The typeorm half is a real, separate defect — see below.

### Defects this work exposed, owned elsewhere

- **A callable passed as a call argument gets no body scope.** Reproduced minimally: a call inside `it("x", async () => { … })` produces no `CallReference`, and indexing logs `No body scope found for <anonymous>`. Its enclosed calls therefore belong to no call-graph node, so they surface as textual hits with empty `captures`. This is why typeorm's six overrides still route to `syntactic_extraction` — their only callers live inside mocha `it(...)` callbacks. Owned by the `syntactic_extraction` epic, not fixable here.
- **Declaration shapes the indexer does not record still count as call sites**: TypeScript overload signatures (627 single-line `function name(...): T;` declarations in `microsoft--TypeScript/src` alone), `declare function`, and object-literal method shorthand. `build_callable_declaration_keys` can only reject what `get_callable_definitions()` knows about, so closing this means indexing those shapes — an `index_single_file` change, not a qualification one.
- **`attach_unindexed_test_grep_hits` is now near-empty for whole-project runs**, because the file set it subtracts is every discovered file. Sub-task 1.2 re-keys it to discovered-minus-indexed; until then the `coverage_config` signal is only reachable on folder-scoped runs. Its hits are already qualified by the same rules, so a comment in an unindexed file can no longer route an entry there.
