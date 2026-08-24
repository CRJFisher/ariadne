# Measuring a corpus load

This harness measures what a full-corpus load costs and guards what it produces.
Both halves exist because this codebase's headline claim — entry points reported
for a repository of vscode's scale — is a number, and a number without its
predicate is not a measurement.

## The unit rule

**Serial arms are judged on CPU.** Wall clock on a shared box measures
scheduling, not work. Full-corpus runs on an idle box recorded cpu/wall between
0.97 and 1.09; the same hardware under load recorded 0.04 to 0.5 at loadavg
100–273 against 4 CPUs. The 11.23-hour figure this epic started from is a wall
number taken at roughly 5× oversubscription.

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
corpus is wrong by a factor nobody can predict. Two fits taken during this epic
missed by **2.19×** and **16.8×**. A budget stated for the corpus comes from an
arm that ran the corpus.

## Ratios: same session, same machine, or not at all

Absolute CPU is machine-bound and does not transfer even between two runs of
provably identical computation. One arm producing byte-identical structural
output — 7,891 files indexed, 603 dropped, 183,018 nodes, 1,502,343 call
references, 26,610 indirect entries — measured **777.6 s, 801.3 s and 1,019.4 s**
in three sessions on one machine.

So a speedup is only ever a candidate arm divided into a control arm that ran
interleaved with it, in the same session, on the same machine. A ratio taken
across sessions was wrong by 40%: an export-gate repair was reported at 2.202×
and measured **1.570×** once a verifier built their own control. `compare_measurements`
refuses the inadmissible cases rather than trusting the caller to remember.

Arms interleave **A,B,A,B** rather than A,A,B,B so both arms share whatever
thermal and scheduling drift the session has.

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

The seventh is not decoration. An order-dependence in which read site got
recorded as a function's reachability evidence survived the six-number version
entirely, because it never moves entry-point membership.

The dropped set belongs in it because it grows with the corpus — 1 file at
n=100, 3 at n=120, 8 at n=200 — so a fingerprint compared across two
differently-sized slices means nothing without it.

Calls are enumerated from the resolution registry, not from each node's
`enclosed_calls`. A call at module scope has no enclosing function scope and so
reaches no node: on the 200-file `src/vs/base` slice, 2,114 of 15,428 calls
(13.7%) are invisible from the nodes alone — and those are exactly the
module-level registration calls of the exported-singleton idiom the recorded
order-dependence clustered on.

## Corpora and predicates

A predicate names a folder set **and** an extension set, because a folder alone
does not identify a file set. `src/vs/base` holds four `.js` files and two of
them sort inside the first 200, displacing two `.ts` files. The two 200-file sets
index and drop identically — 191 and 9 either way — and diverge on everything
else: 5,070 nodes and 1,728 entry points against 4,917 and 1,673.

At microsoft/vscode `f3fa55c3`, four defensible counts:

| predicate | files |
| --- | --- |
| Ariadne's walk over `src/` | 8,494 |
| Ariadne's walk at the repository root | 12,654 |
| shell: `.ts` under `src/` excluding `.d.ts` | 8,451 |
| shell: `.ts` under `src/` including `.d.ts` | 8,648 |

`src/` costs 510.3 s of CPU and the repository root 1,653.9 s. They answer the
ten-minute question differently, so rows for the two are never compared.

## Quoting a number

Every recorded figure names its corpus commit, discovery predicate, file count,
Ariadne commit, machine and node version. `format_citation` renders that line:

```text
microsoft/vscode@f3fa55c3 · folder-ts:src/vs/base · 200 of 479 files · ariadne@12458246 · Darwin 21.6.0 x64 · node v22.23.2
```

## Memory

Peak RSS is reported as a mean over at least two runs with the spread, never as
a single figure: it varies by up to 61% run to run on one arm and one input,
while the settled heap on the same runs is stable to 0.01%. `summarize_samples`
refuses fewer than two runs.

The RSS sampler cannot observe the trace phase, which is fully synchronous — so
`peak_rss_mb` is a defensible lower bound rather than a true high-water mark. On
a sub-second arm it is close to meaningless; on a corpus-scale arm the load phase
yields often enough to sample properly (measured: 55 samples over an 18.5 s load).

## Running it

The corpus is absent in CI and in most checkouts, so corpus-scale **rows** skip
cleanly. The fingerprint mechanism itself never skips: it is guarded on every
test run against `packages/core/benchmark_corpus`, a nine-file corpus committed
beside this module and shaped so all seven components are non-empty.

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

Arms run in separate processes at `--max-old-space-size=6144`; the corpus
exhausts node's default ceiling, and an arm large enough to hit it refuses to
start rather than dying after hours.

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
reproduce, on Ariadne `12458246`: **191 indexed, 9 dropped, 4,917 nodes, 1,673
raw entry points**. Use `--predicate folder-ts:src/vs/base --slice 200`; the
plain `folder:` form is a different file set and gives 5,070 and 1,728.

## Determinism

A multi-order run that reports "no difference" is worth exactly as much as the
demonstration that it could report one. That demonstration is
`RECORDED_ORDER_SENSITIVITY`, measured on the pre-TASK-381.11 tree: over the same
8,494 files, forward against largest-first moved 31 entry points (17,994 → 17,973
— a net 21, because 26 left and 5 entered) and changed four of five recorded
hashes while the node hash held still. Those values came from a different
algorithm over a five-component fingerprint and can never be recomputed here,
which is why they are named `legacy_hashes` and flagged incomparable.

That the comparison can see each of the seven components move is proven in
`call_graph_fingerprint.test.ts` over a synthetic fingerprint. It is deliberately
not re-proven at corpus scale: the proof does not read member content, and
running it there would re-sort and re-digest two million members seven times on
every verdict.
