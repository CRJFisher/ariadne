# TASK-376 wave 1 — session prompts

Eight sessions finish wave 1. Sessions 1–6 review one worktree each and run in parallel; each
ends with its work STAGED and uncommitted, and has a follow-up prompt (section "Follow-up
commits") to send to that same session after work hours, which makes the commits. Session 7
merges the committed branches and runs after hours too, since merges are commits. Session 8
runs after session 7 and has its own follow-up commit prompt.

Every session shares this context, pasted at the top of each prompt:

> Ariadne (`/Users/chuck/workspace/ariadne`) detects call graphs to find a codebase's entry
> points. Epic TASK-376 records five type facts once so receiver-directed calls resolve; wave 1
> (six steps) is implemented, verified and STAGED, uncommitted, in six worktrees under
> `.worktrees/task-376.<N>` on branches `feat/task-376.<N>`, all based on
> `feat/self-healing-pipeline-debug` at `279221d4`. The task docs in each worktree carry ticked
> acceptance criteria with evidence and an `## Implementation Notes` section that records every
> deviation. Environment: the `tsx` CLI cannot open its IPC socket in the sandbox, run scripts
> as `node --import tsx <script>`; headless Chrome (cdoc screenshots) needs the sandbox
> disabled; each worktree has its dependencies installed and `@ariadnejs/types`, `skill-fs`,
> `skill-protocol` and `core` built into `dist` (rebuild `pnpm --filter @ariadnejs/types build`
> if `packages/types/src` changes). Full assertion: `cd packages/core && npx tsc --noEmit &&
npx vitest run`, then `pnpm lint` at the root.
>
> Commits happen only when the user sends the follow-up commit prompt, outside work hours.
> Until then, do not run `git commit`, `git merge`, `git rebase` or `git push`: every change
> stays in the working tree and is STAGED with `git add -A` before you report, and the session
> stays open for the follow-up. Commits, when asked for, are task-scoped Conventional Commits
> (`feat(376.N): …`, `fix(376.N): …`, `test(376.N): …`, `docs(376.N): …`), subject imperative,
> body stating the user-visible behaviour and why; no attribution lines or trailers. Never push.
> Never merge into `feat/self-healing-pipeline-debug`; session 7 does that.

---

## Session 1 — review TASK-376.16 (stage now, commit after hours)

```
Finish TASK-376.16 ("Emit a ResolutionFailure for every dropped call reference and count the
failure taxonomy per corpus"). Work only in /Users/chuck/workspace/ariadne/.worktrees/task-376.16
on branch feat/task-376.16. The implementation is staged and uncommitted; your job is to review
it, fix what survives verification, and hand it back staged; the commit comes later, when the user sends the follow-up prompt to this session. Read the shared
context above first.

Read: the task doc `backlog/tasks/task-376.16 - *.md` in the worktree (spec, ticked criteria,
Implementation Notes), `~/.claude/skills/build-and-review/review-lenses.md`, and
`.claude/rules/{testing,surplus-code,stage-boundaries,file-naming}.md`.

What is staged (`git diff --cached --stat`): call_resolver.ts and its test; in
benchmark_corpus_load/: failure_taxonomy.ts (+test), recorded_failure_taxonomy_baseline.ts
(+test), arm_result_file.ts, benchmark_corpus_load.ts, corpus_predicate.ts,
recorded_order_independence.ts, index.ts and their tests; scripts/run_load_benchmark.ts and
scripts/recorded_measurement_report.ts; the task doc.

Facts the reviewers need:
- The audit found no producer in call_resolution/ that returns ok([]); the exit is closed
  structurally in resolve_calls's tail (empty_dispatch_failure), so the invariant tests
  ("resolved-plus-failed invariant" in call_resolver.test.ts) pass on the base tree too — by
  design, not by accident. The property_access and non-call exits state the exclusion.
- failure_taxonomy is counted over the same registry and indexed files as the fingerprint and
  refuses a call with neither target nor reason. It is persisted on its own line in the arm
  result file; a file without it is refused.
- run_load_benchmark.ts gained a --baseline mode (one arm, forward, full), heap sizing from
  the discovered count with a physical-memory refusal, and a repository-root-excluding:<p,q>
  predicate that appends a triage config's exclude list as gitignore-style patterns.
- The recorded baseline holds nine corpora and one refusal (microsoft/TypeScript, 19,783 files,
  35,122 MB heap needed on a 32,768 MB box). Its rows were measured on 279221d4 plus this
  uncommitted change; `ariadne_commit` reads 279221d4. Leave the provenance comment as it
  stands; the follow-up commit step decides whether to name the new commit.
- The corpus arms are expensive (angular ~100 s CPU, django ~255 s, pandas ~195 s); do not
  re-run them unless a reviewer finds the counting wrong.

Do, in order:
1. Execution gate: full assertion (tsc, vitest, lint) green before anything else.
2. Review: pick the profile from review-lenses.md (this diff is medium: six lenses —
   correctness-behavioural ×2, contracts, test quality, completeness vs spec, cold read).
   Launch all reviewers in one message, model opus, read-only, each with the diff, the task
   doc's criteria, the facts above, its lens prompt and the finding schema.
3. Verification gate per review-lenses.md: cluster, verify each blocker/major against the
   source, drop unverifiable findings, list the noted-not-actioned tail.
4. Apply fix-now findings at the root; re-run the execution gate; re-review the fix diff with
   one correctness reviewer (max two rounds); anything still open goes in the report.
5. Doc: leave the frontmatter status In Progress (the user sets Done when they commit),
   refine `## High-level summary` if the fixes changed the shape, keep every criterion's
   evidence true. Run the cdoc refresh: invoke /cdoc on the task doc path with no feedback so
   the companion page (`…failure-ledger.html` beside the doc in the MAIN checkout's
   backlog/tasks) is diffed against the as-built state; copy the final doc back to the main
   checkout's backlog/tasks.
6. Stage: `git add -A` in the worktree; do not commit yet. Confirm `git status` shows nothing
   unstaged.
7. Report: the findings that changed code, the ones noted, what is staged, and anything left;
   then wait for the follow-up commit prompt.
```

---

## Session 2 — review TASK-376.1 (stage now, commit after hours)

```
Finish TASK-376.1 ("Mint collection member ids that name real definitions"). Work only in
/Users/chuck/workspace/ariadne/.worktrees/task-376.1 on branch feat/task-376.1. The
implementation is staged and uncommitted; review it, fix what survives verification, hand it
back staged; the commit comes later, when the user sends the follow-up prompt to this
session. Read the shared context above first.

Read: the task doc `backlog/tasks/task-376.1 - *.md` in the worktree,
`~/.claude/skills/build-and-review/review-lenses.md`, and
`.claude/rules/{testing,semantic-indexing,surplus-code,file-naming}.md`.

What is staged: queries/javascript.scm and queries/typescript.scm (a new
`@definition.anonymous_function` rule for a function value assigned onto a member of any
holder other than `exports`/`module`/`module.exports`), symbol_factories.javascript.ts
(object-literal shorthand method id keyed on the name node) and its test (the
"collection member ids name real definitions" describe: four inline shapes, a sweep over the
JavaScript fixture corpus pinned at 31 files / 62 recorded ids / zero phantoms),
resolve_references.javascript.test.ts (express same-file case over the new fixture
tests/fixtures/javascript/code/integration/express_application.js), the task doc.

Facts the reviewers need:
- The doc's premise was wrong on the base tree: only the named-function-expression shape
  agreed with the definition builder. The user chose to fix both remaining mint sites in this
  step; the .scm change is the scope extension, mirrored in typescript.scm because the
  TypeScript handlers spread the JavaScript ones.
- The regex on the new rule is `^(exports|module|module[.]exports)$` (character class, no
  backslash). `exports.x = () => {}` nested inside a function body still records no
  definition — a known limitation stated in the Implementation Notes.
- Base-tree check: the anonymous/arrow case, the object-literal case and the corpus sweep fail
  on the base sources; the named-expression case and the express case pass on base (pins).
- A merge-time re-pin is expected: TASK-376.12 adds two JavaScript fixture files, so
  the 31/62 sweep count moves. Do not pre-empt it.

Do, in order: execution gate; review with the small profile (three lenses:
correctness-behavioural, completeness vs spec, cold read — this is a small diff) launched in
one message, opus, read-only; verification gate; fixes at the root and re-review of the fix
diff (max two rounds); doc status stays In Progress, High-level summary refined, cdoc refresh
via /cdoc on the doc path (companion `…member-id-identity.html` lives in the MAIN checkout's
backlog/tasks; copy the final doc there); `git add -A` (no commit yet); report what is staged and wait for the follow-up commit prompt.
```

---

## Session 3 — review TASK-376.2 (stage now, commit after hours)

```
Finish TASK-376.2 ("Delete the Python heuristic constructor capture and stop the annotation
clobber"). Work only in /Users/chuck/workspace/ariadne/.worktrees/task-376.2 on branch
feat/task-376.2. The implementation is staged and uncommitted; review it, fix what survives
verification, hand it back staged; the commit comes later, when the user sends the follow-up prompt to this session. Read the shared context above first.

Read: the task doc `backlog/tasks/task-376.2 - *.md` in the worktree,
`~/.claude/skills/build-and-review/review-lenses.md`, and
`.claude/rules/{testing,resolve-references,semantic-indexing,surplus-code}.md`.

What is staged: queries/python.scm (heuristic `@reference.constructor` capture and its header
paragraph deleted; the call section's comment rewritten), registries/type.ts
(`update_file(file, index, references, definitions, …)` now reads constructor bindings from
the file's preprocessed references; STEP 1 guarded by `names_a_type`; annotation bindings
spread last), project/project.ts (phase 4 passes `this.references.get_file_references(file_id)`),
type.test.ts, callable_instance.python.test.ts, function_call.test.ts (call sites),
constructor_bindings.test.ts (Python cases load through a Project), index_single_file.python.test.ts
(five heuristic-describing tests restated as what the index records), project.integration.test.ts
(Python construction case restated at the Project tier), query_code_tree.test.ts
(`reference.constructor` dropped from the Python capture list; one pre-existing
`definition.variable` duplication at a typed local assignment pinned in `known_duplicates` and
`KNOWN_RANGE_COLLISIONS`), project.python.integration.test.ts (two Project-tier cases over the
new fixtures tests/fixtures/python/code/integration/{parsers,uses_parsers}.py), the task doc.

Facts the reviewers need:
- Deleting the capture alone lost `x = Parser()` typing (probed on the base tree), because
  the type registry read `index.references`, never the rewritten registry; the marshaller's
  own comment claimed otherwise. Threading the preprocessed references is the root-cause fix.
  project.ts is touched for that one argument.
- Base-tree check: both Project-tier integration tests fail on the base sources.
- `parser = dispatch(flavor); parser.close()` reports receiver_type_unknown by design (no
  annotation, no return type); TASK-376.11 is where that receiver gains a type.
- The capture duplication pinned in query_code_tree.test.ts exists with the base grammar too
  (verified by stashing python.scm); it is owned by TASK-374.5.
- Merge-time interactions: TASK-376.12 edits python.scm's block-scope section and one
  call site in type.ts (STEP 1b), both disjoint from this step's hunks.

Do, in order: execution gate; review with the medium profile (six lenses) launched in one
message, opus, read-only; verification gate; fixes at the root and re-review of the fix diff
(max two rounds); doc status stays In Progress, High-level summary refined, cdoc refresh via
/cdoc on the doc path (companion `…constructor-capture.html` in the MAIN checkout's
backlog/tasks; copy the final doc there); `git add -A` (no commit yet); report what is staged and wait for the follow-up commit prompt.
```

---

## Session 4 — review TASK-376.3 (stage now, commit after hours)

```
Finish TASK-376.3 ("Record the scope's self type as LexicalScope.self_type_name"). Work only
in /Users/chuck/workspace/ariadne/.worktrees/task-376.3 on branch feat/task-376.3. The
implementation is staged and uncommitted; review it, fix what survives verification, hand it
back staged; the commit comes later, when the user sends the follow-up prompt to this
session. Read the shared context above first.

Read: the task doc `backlog/tasks/task-376.3 - *.md` in the worktree,
`~/.claude/skills/build-and-review/review-lenses.md`, and
`.claude/rules/{testing,semantic-indexing,surplus-code,file-naming}.md`.

What is staged: packages/types/src/lexical_scope.ts (the readonly field), scopes/boundary_base.ts
(`extract_self_type_name` on the interface with the common default), the four extractors
(JS/TS class_body, TS interface_body/enum_body, Python class-body block via a shared
`find_enclosing_class_definition`, Rust struct/enum/trait bodies and impl declaration lists
through a local `implemented_type_name`), scopes/scopes.ts (reads it once per capture),
rust_scope_boundary_extractor.test.ts (eight direct cases), scopes.test.ts (the
"self_type_name" describe: every scope of a JS, TS, Python and Rust snippet, plus the
cross-file fixture tests/fixtures/rust/code/integration/{types,impls}.rs), and
`self_type_name: null` added to every LexicalScope literal in ten test files plus three
helpers, the task doc.

Facts the reviewers need:
- The Rust read deliberately does not reuse extract_impl_type from symbol_factories.rust.ts:
  its fallback returns the type node's full text, so `impl Tr for &S` would record `&S`.
- The Python class scope keeps `name: null` (its capture is the body block; extract_scope_name
  is untouched) while self_type_name carries the class.
- Nothing reads the field yet; TASK-376.5 is the first reader. All thirteen new tests fail on
  the base sources. The types package dist was rebuilt in the worktree.

Do, in order: execution gate (rebuild @ariadnejs/types first if you touch packages/types);
review with the medium profile (six lenses) launched in one message, opus, read-only;
verification gate; fixes at the root and re-review of the fix diff (max two rounds); doc
status stays In Progress, High-level summary refined, cdoc refresh via /cdoc on the doc path
(companion `…self-type-on-the-scope.html` in the MAIN checkout's backlog/tasks; copy the
final doc there); `git add -A` (no commit yet); report what is staged and wait for the follow-up commit prompt.
```

---

## Session 5 — review TASK-376.4 (stage now, commit after hours)

```
Finish TASK-376.4 ("Make the member index complete: enums, cross-file union, reverse
lookup"). Work only in /Users/chuck/workspace/ariadne/.worktrees/task-376.4 on branch
feat/task-376.4. The implementation is staged and uncommitted; review it, fix what survives
verification, hand it back staged; the commit comes later, when the user sends the follow-up prompt to this session. Read the shared context above first.

Read: the task doc `backlog/tasks/task-376.4 - *.md` in the worktree,
`~/.claude/skills/build-and-review/review-lenses.md`, and
`.claude/rules/{testing,resolve-references,surplus-code,stage-boundaries}.md`.

What is staged: registries/definition.ts (`attach_members(type_id, file, entries)` as the
single writer of member_index / members_by_file / members_by_name; `member_takes_slot`;
update_file feeds ordered entries and attaches alias rebindings; `forget_contributed_members`
on remove_file; `get_members_by_name`, `get_member_closure`; verify_reverse_indices rebuilds
the two new indices, `first_divergence` widened to string keys), definition.test.ts ("member
index across files" and "get_member_closure" describes), resolve_references.rust.test.ts
(same-file field/method collision at the Project tier), the task doc.

Facts the reviewers need:
- The rule: a property never displaces a callable; a setter/deleter never displaces anything;
  a callable displaces whatever else holds the name. It mirrors set_member_symbol and adds
  the callable-over-property clause the Rust collision needs (on base, `job.run()` resolved to
  the field).
- Provenance is a set of names per (file, type); a name two files contend for belongs to the
  file whose member holds it, the loser's provenance releases it, and the verifier rebuilds
  provenance from each held member's defining file. The lossy corner (two files defining one
  member name for a type, then the winner evicted) is documented.
- `get_members_by_name` and `get_member_closure` have no pipeline caller until TASK-376.14 and
  TASK-376.8. If the dead-code Stop hook blocks on them at session end, do not whitelist them
  and do not delete them: report the hook output and ask the user how to proceed
  (rules/hook-errors.md).
- Base-tree check: all twelve new tests fail on the base registry.

Do, in order: execution gate; review with the medium profile (six lenses) launched in one
message, opus, read-only — the data-and-failure-modes lens is worth adding here (eviction,
re-index, overwrite transfer); verification gate; fixes at the root and re-review of the fix
diff (max two rounds); doc status stays In Progress, High-level summary refined, cdoc refresh
via /cdoc on the doc path (companion `…member-union.html` in the MAIN checkout's
backlog/tasks; copy the final doc there); `git add -A` (no commit yet); report what is staged and wait for the follow-up commit prompt.
```

---

## Session 6 — review TASK-376.12 (stage now, commit after hours)

```
Finish TASK-376.12 ("Collapse module-member lookup and fix guarded and function-local import
bindings"). Work only in /Users/chuck/workspace/ariadne/.worktrees/task-376.12 on branch
feat/task-376.12. The implementation is staged and uncommitted; review it, fix what survives
verification, hand it back staged; the commit comes later, when the user sends the follow-up prompt to this session. Read the shared context above first.

Read: the task doc `backlog/tasks/task-376.12 - *.md` in the worktree,
`~/.claude/skills/build-and-review/review-lenses.md`, and
`.claude/rules/{testing,resolve-references,semantic-indexing,surplus-code}.md`.

What is staged: export_chain_lookup.ts (one `resolve_module_member(source_file, name,
import_kind, exports, definitions, languages, modules)`: export chain, then a module-scope
definition — exported for languages with export markers, any for Python), method_lookup.ts
(three import-shaped branches), receiver_resolution.ts, constructor.ts and one line of
registries/type.ts STEP 1b (all callers of the deleted functions), queries/python.scm (no
`@scope.block` for if/elif/else/try/except/finally/with; for/while/match/case and the
comprehensions keep theirs), index_single_file.python.test.ts and scopes.test.ts (tests that
pinned the removed scopes restated as the fact that replaced them; the decorated-__init__
case nests a for loop), resolve_references.python.test.ts (the guarded-imports describe over
tests/fixtures/python/code/integration/{guarded_base,guarded_imports}.py; the
underscore-private namespace case inverted), project.typescript.integration.test.ts (two-hop
re-export over tests/fixtures/typescript/code/integration/reexport_{engine,barrel,consumer}.ts),
resolve_references.javascript.test.ts (cross-file require + mixin over
tests/fixtures/javascript/code/integration/mixin_{application,express}.js), the task doc.

Facts the reviewers need:
- Two unit tests fix the fallback's contract: an exported top-level definition answers for
  every language even when the export registry holds no record; a non-exported one answers
  only in Python (method_lookup.test.ts "fails with reexport_chain_unresolved for a
  non-exported class in the source file").
- Base-tree check: the Python guarded-import test and the inverted underscore test fail on
  the base sources; the TypeScript and mixin cases pass on base (pins — receiver resolution
  dereferences a named import before method_lookup's branch).
- Criterion 5 is unticked: the module-receiver rows were re-measured with a local count on
  celery (resolved 13,140 → 13,153; method_not_on_type 5,339 → 5,326), not the harness, and
  the Rust `TestRequest::new` rows were not measured. Session 8 does both; do not attempt them.
- python_scope_boundary_extractor.ts needed no change; the doc's "adjust accordingly" was
  moot.
- Each construction in the guarded-imports fixture is recorded twice on this tree; TASK-376.2
  removes the second record, so that literal moves at merge (session 7). Do not
  pre-empt it.
- registries/type.ts belongs to TASK-376.2; this step changes one call site because the old
  function no longer exists. The merge is two disjoint hunks.

Do, in order: execution gate; review with the medium profile (six lenses) launched in one
message, opus, read-only; verification gate; fixes at the root and re-review of the fix diff
(max two rounds); doc status stays In Progress, refine the High-level summary, cdoc refresh
via /cdoc on the doc path (companion `…module-member-lookup.html` in the MAIN checkout's
backlog/tasks; copy the final doc there); `git add -A` (no commit yet); report what is staged and wait for the follow-up commit prompt.
```

---

## Follow-up commits — send to each of sessions 1–6 after work hours

One prompt, with `<N>` filled in (16, 1, 2, 3, 4, 12). Send it to the session that reviewed
that worktree, or paste it into a new session with the shared context above.

```
Work hours are over: commit the staged work of TASK-376.<N> in
/Users/chuck/workspace/ariadne/.worktrees/task-376.<N> on branch feat/task-376.<N>. First
confirm `git status` shows everything staged and nothing unstaged, and that the full assertion
was green at the end of the review (re-run it if anything changed since). Then set the task
doc's frontmatter status to Done (TASK-376.12 stays In Progress until session 8 ticks its
criterion 5), copy the doc to the main checkout's backlog/tasks, and commit in the worktree
as task-scoped Conventional Commits: feat(376.<N>) for the production change, test(376.<N>) if
you split the tests out, docs(376.<N>) for the doc — subject imperative, body stating the
user-visible behaviour and why, no attribution lines or trailers. Respect the commit-msg hook;
never bypass it by editing config. For TASK-376.16 add one line to the provenance comment of
recorded_failure_taxonomy_baseline.ts naming the feat commit the rows were taken with, in the
docs commit. Do not push and do not merge. Report the commit hashes and subjects.
```

---

## Session 7 — merge wave 1 (after hours, after every follow-up commit has landed)

```
Merge the six wave-1 branches of epic TASK-376 into feat/self-healing-pipeline-debug, in slot
order, and leave the integration branch green. This session commits: merges are commits. Read
the shared context above first, then the epic's Implementation Plan in
`backlog/tasks/task-376 - Record-the-five-type-facts-once-and-resolve-members-over-a-single-
lookup-ladder.md` ("Rules for every step": a merge conflict is resolved against the task doc,
never by dropping either side).

Work in the main checkout /Users/chuck/workspace/ariadne on feat/self-healing-pipeline-debug.
Confirm each branch has commits (`git log feat/self-healing-pipeline-debug..feat/task-376.<N>`)
and each worktree is clean before starting; stop and report if any is still uncommitted. The
main checkout's backlog/tasks holds uncommitted doc and companion changes: leave them in place
and carry them through — they are the current docs.

Order: feat/task-376.16, feat/task-376.1, feat/task-376.2, feat/task-376.3, feat/task-376.4,
feat/task-376.12. After each merge run `pnpm --filter @ariadnejs/types build` (376.3 adds a
LexicalScope field) and the full assertion.

Known merge points (disjoint hunks, resolve by taking both sides):
- registries/type.ts: 376.2 (update_file signature, extract_type_data, STEP 1 guard) and
  376.12 (STEP 1b now calls resolve_module_member).
- queries/python.scm: 376.2 (call section) and 376.12 (block-scope section).
- index_single_file.python.test.ts, scopes.test.ts, call_resolver.test.ts,
  resolve_references.javascript.test.ts: two steps each, different regions.
- tests/fixtures/python/code/integration/: created by 376.2 and 376.12 with different files.

Pinned literals that legitimately move once everything is merged — re-measure and re-pin
each, and say so in the commit body:
- call_resolver.test.ts "resolved-plus-failed invariant": all four corpus rows (376.1, 376.3
  and 376.12 add fixture files; 376.2 halves Python call records).
- symbol_factories.javascript.test.ts corpus sweep (31 files / 62 ids): 376.12 adds two
  JavaScript fixtures.
- resolve_references.python.test.ts guarded-imports literal: the duplicate construction
  records disappear with 376.2.
- query_code_tree.test.ts Python known_duplicates / KNOWN_RANGE_COLLISIONS: re-run; 376.12's
  Python fixtures may add a pre-existing-shape duplicate — pin it with a comment if so.
Do NOT re-record recorded_failure_taxonomy_baseline.ts: it is the pre-epic row every later
step measures against, taken on step 1's tree by design.

Then: full assertion on the merged tree; the Stop-hook checks that apply (stage boundary,
dead code, file naming) — if the dead-code hook flags get_members_by_name /
get_member_closure (376.4; consumers land in later waves), report it and ask rather than
whitelisting. Commit the merges (merge commits, plus one `test(376): re-pin corpus literals
after the wave-1 merge` for the re-pins) and a `docs(376): …` commit that lands the main
checkout's wave-1 doc and companion changes and marks the epic's wave-1 entries complete. Do
not push. Report: merge order, conflicts and how each was resolved, every re-pinned literal
with old and new values, suite result, commit hashes.
```

---

## Session 8 — measure the rows wave 1 owes (after session 7; stage now, commit after hours)

```
Record the measurements wave 1 of epic TASK-376 left open, on the merged
feat/self-healing-pipeline-debug in /Users/chuck/workspace/ariadne. Read the shared context
above first, then `packages/core/src/benchmark_corpus_load/README.md` (the unit rule) and
`packages/core/scripts/run_load_benchmark.ts --help`. Stage the results; the commit comes
later, when the user sends the follow-up prompt to this session.

The control arm is a checkout of 279221d4: create it with
`git worktree add .worktrees/control-279221d4 279221d4`, then in it `pnpm install
--frozen-lockfile` and build `@ariadnejs/types`, `@ariadnejs/skill-protocol`,
`@ariadnejs/skill-fs` and `@ariadnejs/core`. The candidate is the main checkout.

Three measurements:
1. TASK-376.12 criterion 5, module-receiver rows: run
   `node --import tsx packages/core/scripts/run_load_benchmark.ts --interleave --corpus-root
   ~/.ariadne/triage-entrypoints/repos/celery--celery --corpus-name celery/celery
   --corpus-commit $(git -C ~/.ariadne/triage-entrypoints/repos/celery--celery rev-parse HEAD)
   --predicate repository-root --control-repo /Users/chuck/workspace/ariadne/.worktrees/control-279221d4
   --candidate-repo /Users/chuck/workspace/ariadne` and the same for django with
   `--predicate repository-root-excluding:js_tests,scripts,docs`. The report prints the
   per-reason taxonomy side by side; record the deltas in TASK-376.12's doc under criterion 5
   and tick it.
2. TASK-376.12 criterion 5, Rust `TestRequest::new` rows: over
   ~/.ariadne/triage-entrypoints/repos/actix--actix-web (predicate repository-root), count with
   the same interleaved pair how `TestRequest::new` call sites resolve on control and candidate;
   record the count in the same doc.
3. TASK-376.16 criterion 4, the refused corpus: microsoft/TypeScript discovers 19,783 files
   under repository-root-excluding:baselines, which the harness refuses at a 35,122 MB heap on
   this 32 GB box. Either run it on a box that can hold it, or record a narrower predicate
   (`folder:src` is the compiler proper) as a separate row — a narrower predicate is a
   different file set and must be named as such, never substituted for the refused one.
   Append the row to recorded_failure_taxonomy_baseline.ts and extend its test.

Serial arms; note loadavg; no figure from a slice is quoted as a corpus figure. `git add -A`
when done (no commit yet). Report the numbers against the baseline rows and the staged file
list, then wait for the follow-up commit prompt.
```

Follow-up for session 8, after hours:

```
Work hours are over: commit the staged measurement work on feat/self-healing-pipeline-debug
in /Users/chuck/workspace/ariadne. Confirm `git status` shows everything staged, set
TASK-376.12's doc status to Done, and commit as docs(376.12) for the criterion-5 rows and
feat(376.16) for any new recorded row, with subjects in the imperative and bodies stating
what was measured against what; no attribution lines. Do not push. Report the hashes.
```

---

## After wave 1

Wave 2 (TASK-376.5 `find_self_type`, TASK-376.6 the annotation resolver) uses the original
wave-1 session prompt with the "Order" entries for steps 7 and 8, branching from the merged
feat/self-healing-pipeline-debug. The notes wave 1 left on those docs ("Notes from wave 1")
carry the contracts they depend on.
