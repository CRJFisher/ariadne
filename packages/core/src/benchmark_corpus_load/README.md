# Measuring a corpus load

This harness measures what a full-corpus load costs and guards what it produces.
Both halves exist because this codebase's headline claim — entry points reported
for a repository of vscode's scale — is a number, and a number without its
predicate is not a measurement.

## The unit rule

**Serial arms are judged on CPU.** Wall clock on a shared box measures
scheduling, not work. Full-corpus runs on an idle box recorded cpu/wall between
0.97 and 1.09; the same hardware under load recorded 0.04 to 0.5 at loadavg
100–273 against 4 CPUs. One 11.23-hour figure on record is a wall number taken
at roughly 5× oversubscription of work that costs a fraction of it.

**Worker-pool arms are judged on wall, taken on an idle box, with CPU reported
alongside.** A pool's whole point is to finish sooner in wall-clock terms while
spending the same or more CPU, so CPU alone would report a successful
parallelisation as a regression. `process.cpuUsage()` counts worker-thread time
in-process — measured, a 1,500 ms worker spin counted as 1,492 ms — so the CPU
number stays meaningful for a pool. It does **not** count a child process's time:
the same spin in a child counted as 2 ms in the parent, which is why the
orchestrator takes every number from the arm's own row and never from its own
clock.

**Wall under contention is never a measurement.** Every row carries loadavg and
cpu/wall so a reader can see for themselves whether a wall number means anything.

## No corpus-scale figure without a corpus-scale run

Cost per file is not constant, so a small-slice measurement extrapolated to the
corpus is wrong by a factor nobody can predict. Two such fits missed the
measured corpus cost by **2.19×** and **16.8×**. A budget stated for the corpus
comes from an arm that ran the corpus. `--slices` reports the marginal cost of
the files each slice added over the one before it, which is the curve saying
whether an extrapolation is allowed at all.

## Ratios: same session, same machine, or not at all

Absolute CPU is machine-bound and does not transfer even between two runs of
provably identical computation. One arm producing byte-identical structural
output — 7,891 files indexed, 603 dropped, 183,018 nodes, 1,502,343 call
references, 26,610 indirect entries — measured **777.6 s, 801.3 s and 1,019.4 s**
in three sessions on one machine.

So a speedup is only ever a candidate arm divided into a control arm that ran
interleaved with it, in the same session, on the same machine. A ratio taken
across sessions is wrong by 40%: 2.202× claimed, **1.570×** measured against a
same-session control. `compare_measurements` refuses the inadmissible cases
rather than trusting the caller to remember.

Two arms of one tree measure the session's noise floor rather than a change, so
`--interleave` says so on the line beneath the ratio when both arms report the
same Ariadne commit.

Arms interleave **A,B,A,B** rather than A,A,B,B so both arms share whatever
thermal and scheduling drift the session has.

An interleaved pair names both of its checkouts — `--control-repo` and
`--candidate-repo`, each defaulting to the orchestrator's own tree — so which
tree the orchestrator happens to live in never decides which arm is the
control. The pair also diffs its two fingerprints: a speedup between arms that
describe different call graphs is not a speedup, so a difference prints the
moved components and exits non-zero.

## Grammar versions travel with every row

Two measurement worktrees silently resolved tree-sitter 0.21.1 and
tree-sitter-typescript 0.21.2 from hoisted copies instead of the 0.25.0 and
0.23.2 a normal checkout uses, and the ~40 grammar test failures both reports
waved off as environmental were exactly that. Every row records the versions the
process actually loaded, and two rows whose grammars differ are refused.

## The seven-number fingerprint

Sorted node ids; caller-to-callee pairs with their call-site counts; unresolved
call sites; raw `trace_call_graph` entry points; `indirect_reachability` keys;
the dropped-file set; and the evidence tuple behind each indirect reachability
(function, reason type, collection, read site).

The seventh is not decoration. An order-dependence in which read site is
recorded as a function's reachability evidence never moves entry-point
membership, so nothing but this component shows it.

The dropped set belongs in it because it is the component a coverage loss moves
and nothing else does. It is EMPTY at every slice of every predicate on record
today — over vscode's `src/` it once grew with the corpus, holding 1 file at
n=100, 2 at n=120, 8 at n=200 and 676 at the full 8,494, and every one of those
was the same export-registry defect. Zero is the guarantee; a non-zero reading
is the signal.

A member built from several fields escapes the characters those fields are
joined with — `\`, `>`, `#`, `|` and `@` — so a TypeScript private member name
cannot make one edge read as another. Single-field members carry no separator
and stay verbatim, which is what keeps a committed baseline readable.

Component digests are taken one member at a time, each member fed as its UTF-8
byte length, a colon, then its bytes. Two million members never become one
string, and the encoding is injective, so no member content can make one member
look like two.

Calls are enumerated from the resolution registry, not from each node's
`enclosed_calls`. A call at module scope has no enclosing function scope and so
reaches no node: over the first 200 path-sorted `.ts` files of `src/vs/base` at
f3fa55c3, ingested forward, 1,908 of 15,095 call references have no enclosing
node. Those are the module-level registration calls of the exported-singleton
idiom, which is the construct order-dependence shows up in.

## Corpora and predicates

A predicate names a folder set **and** an extension set, because a folder alone
does not identify a file set. `src/vs/base` holds four `.js` files and two of
them sort inside the first 200, displacing two `.ts` files. The two 200-file sets
diverge on every number a row carries: 5,868 nodes, 1,857 raw entry points and
9,839 resolved edges under `folder:`, against 5,712, 1,801 and 9,657 under
`folder-ts:`. Both now index 200 of 200.

At microsoft/vscode `f3fa55c3`, four defensible counts:

| predicate                                   | files  |
| ------------------------------------------- | ------ |
| Ariadne's walk over `src/`                  | 8,494  |
| Ariadne's walk at the repository root       | 12,654 |
| shell: `.ts` under `src/` excluding `.d.ts` | 8,451  |
| shell: `.ts` under `src/` including `.d.ts` | 8,648  |

`src/` costs 361.8 s of CPU on one 6-core box and the repository root 1,105.7 s
on the same box before the export-registry repair readmitted 676 files. They
answer the ten-minute question differently, so rows for the two are never
compared.

The first two rows are load-bearing. An arm over `microsoft/vscode` at that
commit refuses to run when its discovery walk finds a different count, because
every figure recorded for that corpus is stated over the pinned one.

## Quoting a number

Every recorded figure names its corpus commit, discovery predicate, file count,
Ariadne commit, machine and node version. `format_citation` renders that line:

```text
microsoft/vscode@f3fa55c3 · folder-ts:src/vs/base · 200 of 479 files · ariadne@12458246 · Darwin 21.6.0 x64 · node v22.23.2
```

## What eviction costs

`RECORDED_EVICTION_INDEX_COST` holds the whole-load arms taken when
`DefinitionRegistry` stopped scanning the project to evict one file. Over
vscode's `src/` at f3fa55c3, entries visited inside `remove_file` fall from
83.3M at 200 files, 397.4M at 600 and 1,743,715,817 at 1,200 to **zero**, while
the keyed cost holds flat at 10.61, 10.55 and 10.53 operations per evicted
symbol. Same-session interleaved CPU was 1.07x, 1.13x and 1.22x with a
byte-identical fingerprint at every size.

The entry counts travel between machines because they are a property of the
algorithm; the CPU figures do not, and `--interleave` prints the record beneath
its own arms marked as such.

## What the corpus pass costs

`RECORDED_CORPUS_PASS_COST` holds what changed when the bulk load stopped
driving the file watcher's single-file API and became `ingest_file` per file
followed by one `resolve_corpus()`. Over vscode's `src/` at f3fa55c3, calls to
`resolve_names` fall from 100, 197 and 1,183 at 100, 200 and 1,200 files to
**one** at every size, and peak heap over the 200-file slice falls from 385.7 MB
to 181.2 MB. Every in-corpus import that has a declaration to point at now
points at it — 478 and 3,057 that did not, at 200 and 1,200 files, against zero
— and the residue is exactly the two shapes with no declaration to name, a
wildcard edge and a name the source file does not export.

Three entry points the per-arrival driver reported at 100 files of
`folder-ts:src/vs/base` are gone, each named by symbol:
`ToggleActionViewItem.focus` at `toggle.ts:106`, `ToggleActionViewItem.blur` at
`:111` and `CheckboxActionViewItem.blur` at `:516`. No entry point is added and
the node count holds at 3,203.

The record also carries the cost. This driver loses call edges the per-arrival
driver resolved: 77, 43, 21 and 29 at 1,200 files across the four orders. Most
are edges the per-arrival driver itself failed to resolve under at least one of
forward, reversed and shuffled, so they are instances of a resolver
order-dependence that predates the change. The rest — 22, 4, 10 and 23 — it
resolved under all three named orders, and every one of them reaches a method on
an exported singleton through a constructor binding, which is the defect
TASK-381.11 states against `resolve_corpus` by name. None is a re-target: the
call site stops resolving. Against them the candidate resolves 693 edges forward
the per-arrival driver did not.

## What evicting a batch of files costs

`RECORDED_RESOLUTION_EVICTION_COST` holds what `ResolutionState` eviction costs
under both shapes — one call per file, and one call per batch. Over vscode's
`src/` at f3fa55c3 a cold load's evictions remove nothing at all, because the
two-phase driver resolves once after every file is in the registries: the calls
fall from 1,200 to 56 at 1,200 files, every one of them returns the state it was
given, and clone allocations fall from **6,000 to zero**.

The cost that remains is the incremental one. At 1,200 files, one edit to
`vs/editor/common/core/range.ts` — which 252 files reach — scanned 11.3M scope
entries and cloned 28.5M map entries evicting them one at a time, against
54,684 and 136,729 for the whole batch. The seven components and both
diagnostics digests are identical under the two shapes at 200, 600 and 1,200
files, and identical again after the edits.

That record is also where the copy-on-write question is settled. A full-corpus
profile gives the copy-on-write family a quarter of the run, and that share
belongs to the export-gate rollback path, which evicts one file at a time
against a fully resolved project. A bulk load's own `ResolutionState` work is
two applies over a state that was empty when they cloned it. Making the state
mutable needs a profile of a long-running incremental session, which nobody has
taken.

## What the name table retains

`RECORDED_NAME_TABLE_MEMORY` holds what the per-scope name table costs under both
shapes — a copy of every visible binding in every scope, and each scope's own
bindings chained to its parent's. Over vscode's `src/` at f3fa55c3, retained
bytes measured **by deletion** under forced GC fall from 171.86 to 10.84 KB/file
at 200 files and from 113.73 to 10.02 at 800, because 2,153,280 stored entries
become 71,341 and 36,910 scopes collapse to 21,916 links at mean depth 3.19.

The equivalence is structural rather than sampled: the visible (scope, name)
pair count — every name a lookup in a scope can see, summed over scopes — is
identical under both shapes at every slice, so the chain exposes exactly the
name set the flat table materialised. All seven fingerprint components agree
too, and CPU lands at 0.98–1.00x, which is what says the copying removed pays
for the walking added.

The record also carries `INTERNING_CEILING`, so the cheaper-looking alternative
is not re-proposed from an estimate. Rewriting all 1,455,167 retained string
slots to the canonical instance of their content — the ceiling of any interning
scheme — freed **5.42 KB/file against a 68 KB/file estimate**. V8 already shares
those strings. The path interning that does pay is inside cache blobs, measured
at 2.32x, and belongs to TASK-381.9.

## What a whole corpus costs

`RECORDED_FULL_CORPUS_BASELINE` is the row every later step is judged against:
every file each predicate discovers, offered to one process, run to completion.

Over vscode's `src/` at f3fa55c3 the load indexes **7,818 of 8,494** with 676
dropped, in **337.3 s of CPU** — mean of three independent processes, CV 0.89%,
cpu/wall 1.03–1.05 — at 7,177.6 MB peak RSS. Over the repository root it indexes
11,659 of 12,654 for **1,105.7 s** at 8,352.6 MB. 49% more files costs 3.28× the
CPU, so the two predicates still answer the ten-minute question differently:
5.62 minutes against 18.43.

Where that CPU goes, measured at the phase boundaries of one full-corpus run:

| phase                            | CPU        | share  |
| -------------------------------- | ---------- | ------ |
| parse and index                  | 292,833 ms | 85.03% |
| the rest of the load             | 26,873 ms  | 7.80%  |
| resolve the corpus               | 24,075 ms  | 6.99%  |
| — `resolve_calls_for_files`      | 13,929 ms  | 4.04%  |
| — fix import locations           | 7,074 ms   | 2.05%  |
| — `resolve_names`                | 1,824 ms   | 0.53%  |
| — `resolve_callback_invocations` | 1,908 ms   | 0.51%  |
| drop rollback                    | 187 ms     | 0.05%  |
| `trace_call_graph`               | 440 ms     | 0.13%  |

Entry-point detection is free; the whole cost is the load, and 51.28% of the
load-and-trace subtrees is spent crossing the JavaScript/native boundary to read
tree-sitter node fields. `Project.remove_file` is called **zero** times: a failed
ingest rolls back through `evict_ingested_file`, which costs 187 ms over 676
drops.

Ratios come from a control arm — the tree as it stood before this work — run
interleaved in the same session over nested slices, because the control tree
does not finish the corpus. It buys **1.52× at 200 files, 2.09× at 600 and 3.40×
at 1,200**, and a ratio that rises with the file set is exactly why the
corpus-scale one may not be extrapolated from any of them.

## What keying exports on declaration space moved

`RECORDED_EXPORT_DECLARATION_SPACE` is this corpus's fingerprint re-baseline.
Over vscode's `src/` at f3fa55c3 the load indexes **8,494 of 8,494** with an
empty dropped set, against 7,818 and 676 with the export gate active, and
`Project.remove_file` is called zero times on both arms. All 676 drops were one
defect: the taxonomy over the control arm is the single entry
`Duplicate export name "…" in file <path>` at 676, and `Multiple default
exports` fires on no file of this corpus.

Nothing is lost. `nodes(gate) \ nodes(repair)` is **0** by literal set
difference over the complete node id set, while nodes rise 184,957 → 201,595 and
resolved call edges 322,300 → 1,076,088.

The entry-point accounting is taken at the resolution level — nodes, minus
`get_all_referenced_symbols()`, minus anonymous — because a falling count says
nothing on its own. Raw candidates fall 24,553 → 20,099: of the 6,751 removed,
**6,751 (100.00%)** are in the repaired arm's called set and **0** lost their
node; of the 2,297 added, 2,283 lie inside the readmitted files.

Two commitments the step was written against are refuted by its own arms and are
carried in the record rather than dropped. **The CPU win is not there**: control
362.68 s against candidate 361.77 s, two processes per arm interleaved in one
session, which is 1.00x. The 2.202x and 1.570x on record were both taken on a
tree whose bulk load still rolled a failed ingest back through the incremental
`remove_file`; TASK-381.4 removed that cascade first, so the cost the repair was
expected to remove was already zero. What it buys is 8.65% more files, 16,638
more nodes and 753,788 more resolved edges for CPU the session's noise cannot
distinguish. **And peak RSS is a property of the box**: 6,911.75 MB candidate
against 6,914.1 MB control, a −0.03% difference under run-to-run spreads of 5%
and 7%, so the `<= 6.6 GB` bound describes the machine the earlier figure was
taken on and not this repair.

The residual outside the readmitted files is 17, not the 10 the step budgeted.
Three are classifier decisions — `reverse` at `rangeMapping.ts:51` and
`mergeEditor/model/mapping.ts:74` and `:327`, raw candidates in both arms. The
other 14 are call sites that retarget onto an interface member once the
readmitted `lifecycle.ts` and `event.ts` supply `IDisposable` and `Event`; each
keeps its node, and 21,421 symbols gain an edge against their 14. That
population is TASK-389.

## Memory

### The contract

Reporting entry points over microsoft/vscode at `f3fa55c3`, `src/`, 8,494 files
under Ariadne's discovery walk, requires node to be started with
`--max-old-space-size` of at least **6144**. Measured on ariadne@417de2fc,
Darwin 24.6.0 x64, 6 cores, 32 GiB, node v22.22.1:

| ceiling            | outcome                                                 |
| ------------------ | ------------------------------------------------------- |
| 4,144 MB (default) | dies after 444.3 s of CPU, `Reached heap limit`          |
| 6,144 MB           | 8,494 of 8,494 in 356.22 s of CPU, 5,803.45 MB peak RSS  |
| 12,288 MB          | 8,494 of 8,494 in 349.37 s of CPU, 6,880.9 MB peak RSS   |

Each completing row is a mean of two processes, and the four arms ran
interleaved A,B,A,B in one session, so the **1.02×** the smaller ceiling costs
in CPU is admissible. All four report one call graph — seven components and
both diagnostics hashes, digest for digest — so the ceiling decides whether the
load finishes and never what it finds.

Ariadne sets no heap flag. Setting one needs a re-exec or a `NODE_OPTIONS`
hand-off, which is a second execution path, and it would cover the CLI while
leaving the MCP server and the library consumer with neither the flag nor the
guarantee. The flag belongs on the command line that starts the process.

The floor is `src/`'s and is not carried to the repository root. Over the
12,654 files discovered there, the same stack retains **5,562.95 MB** and peaks
at **8,540.05 MB** — each a mean of two processes at a 22,645 MB ceiling — so a
6,144 MB ceiling would leave 581 MB of working set where `src/` died with 97.9
MB. The floor for that corpus is unmeasured, and a requirement quoted without
its corpus is not a requirement.

### Why the default ceiling fails

The live heap, read after a forced collection, is **4,046.1 MB**, and identical
to a tenth of a megabyte at both ceilings that complete. The default ceiling is
4,144 MB. So the load retains 97.9 MB *less* than the ceiling and still cannot
run under it: the last six collections free 9 to 53 MB each for 1.2 to 2.3
seconds of work, the last at a mutator utilisation of 0.018. What is missing is
mark-compact working set, not room for the data. `RECORDED_MEMORY_CONTRACT`
holds the bracket and TASK-393 is open against the live heap itself.

### Reading a memory figure

Peak RSS is reported as a mean over at least two runs with the spread, never as
a single figure: it varies by up to 61% run to run on one arm and one input,
while the settled heap barely moves. Over five arms on the in-repo corpus, peak
RSS spread 23.8% while the settled heap spread 0.51% — and 0.51% is the
quantisation floor there, since the field is rounded to a tenth of a megabyte on
a 19.5 MB heap. The corpus-scale figure behind the 0.01% claim comes from an arm
three orders of magnitude larger, where a tenth of a megabyte is invisible.
`summarize_samples` refuses fewer than two runs.

A peak RSS figure is quoted with the ceiling it was taken at, because the
collector schedules against that ceiling: 5,803.45 MB at 6,144 MB and 6,880.9
MB at 12,288 MB, over one identical live set. That makes the RSS-to-live-heap
ratio a pair — **1.43× and 1.70×** — and never a constant to project from.

A closing `used_heap_size` is the live set only where the ceiling forces a full
collection. Two processes at 6,144 MB read 5,155.1 and 5,155.4 MB; the same
computation at 12,288 MB reads 5,592.4 and 7,178.8 MB, a 24.84% spread. The
live figure comes from a forced collection under `--expose-gc`, and a run whose
ceiling never forced one supports no ratio at all.

The RSS sampler cannot observe the trace phase, which is fully synchronous — so
`peak_rss_mb` is a defensible lower bound rather than a true high-water mark.
Cross-checked against `/usr/bin/time -l` on vscode arms it runs 0.2–0.7% low. On
a sub-second arm no interval fires at all and it equals the closing reading; on a
corpus-scale arm the load phase yields often enough to sample properly (measured:
55 samples over an 18.5 s load).

## Running it

A corpus of vscode's scale is absent in CI and in most checkouts, so
corpus-scale **rows** skip cleanly. The fingerprint mechanism itself never
skips: it is guarded on every test run against `packages/core/benchmark_corpus`,
a ten-file corpus committed beside this module and shaped so six of the seven
components are non-empty. The seventh, `dropped_files`, is pinned at ZERO: it
was non-empty only because a file of legal JavaScript used to abort indexing,
so its guard was purchased by a bug, and manufacturing a replacement would mean
committing a file Ariadne cannot index as a permanent fixture. That component's
mechanism is proven synthetically in `call_graph_fingerprint.test.ts` instead.

```bash
# Node 22 is required (engines: >=22.13.0 <23.0.0).
npx tsx packages/core/scripts/run_load_benchmark.ts --interleave \
  --corpus-root ~/.ariadne/triage-entrypoints/repos/microsoft--vscode \
  --corpus-commit f3fa55c3 --predicate folder-ts:src/vs/base --slice 200
```

Modes: `--interleave` (A,B,A,B plus a controlled speedup), `--slices` (a nested
cost-per-file curve — every slice is a prefix of the next, so the curve describes
one codebase growing), `--orders` (one file set in four arrival orders, diffed
through the fingerprint).

Each arm runs in its own process, sized by `required_heap_mb` plus a quarter —
12,292 MB required and 15,365 MB given, for the 8,494-file corpus — and an arm
whose own ceiling is below that requirement refuses to start rather than dying
after hours. The requirement is a linear model fitted to two small-slice points
and it over-provisions at corpus scale: the measured floor for vscode's `src/`
is 6,144 MB, and node's 4,144 MB default is what the corpus dies at.

### A second checkout for the candidate arm

An interleaved pair is usually two worktrees of this repository. Create the
second one and symlink `node_modules` from the primary checkout, so both arms
resolve the same grammars:

```bash
git worktree add ../ariadne-candidate <ref>
ln -s "$(pwd)/node_modules" ../ariadne-candidate/node_modules
npx tsx packages/core/scripts/run_load_benchmark.ts --interleave \
  --candidate-repo ../ariadne-candidate ...
```

Without the symlink the second checkout resolves its own dependency tree, which
is how the hoisted-grammar incident happened in the first place.

### The smoke run

The first 200 path-sorted `.ts` files of `src/vs/base` at corpus `f3fa55c3`
reproduce **200 indexed, 0 dropped, 5,712 nodes, 1,801 raw entry points, 8,090
unresolved call sites**. Use `--predicate folder-ts:src/vs/base --slice 200`;
the plain `folder:` form is a different file set.

These are stated over the corpus rather than over one Ariadne commit, because
that is what makes them a smoke run: the Ariadne commit belongs on the row, and
the run prints it in the citation line above the numbers. A change to the
pipeline that moves any of them is the signal the run exists to give. The
coverage half of this line read 185/15 from the start of the load-performance
work until export metadata was keyed on declaration space; it reads 200/0 now,
and 200/0 is what a healthy load of any slice of this corpus looks like.

## Determinism

A multi-order run that reports "no difference" is worth exactly as much as the
demonstration that it could report one. There are two such demonstrations on
record.

`RECORDED_ORDER_SENSITIVITY` is the older one, measured on a tree whose
polymorphic expansion depended on the order files arrived in: over the same
8,494 files, forward against largest-first moved 31 entry points (17,994 →
17,973 — a net 21, because 26 left and 5 entered) and changed four of five
recorded hashes while the node hash held still. Those values came from a
different algorithm over a five-component fingerprint and can never be
recomputed here, so they are a record of one run rather than a value to compare
a current digest with.

`RECORDED_ORDER_INDEPENDENCE` is the live one, and its digests **are**
comparable with a current run because they came from this harness. Over
vscode's `src/` the four orders now agree on all seven components — nodes
201,595, resolved call edges 1,077,986, unresolved 420,958, entry points 17,563,
indirect reachability 29,378 keys and 29,378 evidence tuples, dropped files 0 —
and on the diagnostics `canonical_hash`. Its non-vacuity was taken in the same
session on the tree immediately before the change: forward against descending
byte size over the identical 8,494 files moved 37 entry points (17,647 → 17,620;
32 forward-only, 5 revsize-only) and changed four of the seven components, while
the node hash, the indirect-reachability key set and the dropped set held still.
At 1,200 files the same tree gave four different entry-point sets — 4,163 /
4,160 / 4,156 / 4,162, union 4,168 against intersection 4,151.

The converged answer is a strict improvement rather than a different one, by
literal set difference over the complete member lists: entry points −84 and +0,
resolved caller-to-callee edges +1,898 and −0, unresolved call sites −3,099 and
+0, indirectly-reachable functions +3 and −0, node set byte-identical. The 84
are methods of the exported-singleton idiom, and `receiver_type_unknown` falls
163,174 → 158,233 over the corpus, which is where the 3.5% CPU goes: 1,842 of
the freed call sites now reach member lookup and fail there instead.

What is still order-dependent is the diagnostics payload's `diag_hash`, which
takes four values under one `canonical_hash`. Membership is settled; emission
order is not. It reads the same on the tree before the change, so it is neither
introduced nor removed here.

The diagnostics payload — the evidence a classifier reads about each entry
point — carries its own pair of digests on every row, because its defect class
is invisible to the seven components: entry-point membership is a set
difference, so walk order can only reorder it, while the capped evidence lists
under each entry are fed in whatever order built them. `diag_hash` digests the
payload as extraction emitted it; `canonical_hash` digests a deep-sorted form,
so only a membership difference can move it. The pair's disagreement is a
diagnosis — diag moving while canonical holds is an ordering difference, both
moving is a membership one, and that discrimination is what exposed the
fifty-site evidence cap as a membership defect fed in walk order. A
multi-order run diffs the pair alongside the seven components,
`RECORDED_DIAGNOSTICS_BASELINE` keeps the vscode-slice measurement that
established the property — its hashes verbatim from the investigation's own
algorithm, never a value to compare a current digest with — and the live guard
runs on every test against the in-repo corpus in
`diagnostics_fingerprint.corpus.test.ts`.

That the comparison can see each of the seven components move is proven in
`call_graph_fingerprint.test.ts` over a synthetic fingerprint. It is deliberately
not re-proven at corpus scale: the proof does not read member content, and
running it there would re-sort and re-digest two million members seven times on
every verdict.
