# Benchmark guard corpus

A small corpus the fingerprint mechanism is guarded against on every test run.
A corpus of vscode's scale is absent in CI and in most checkouts, so
corpus-scale rows skip — this is what keeps the mechanism itself from skipping.

## Why it lives here and not under `tests/`

`is_in_test_dir` matches a `tests/`, `test/` or `fixtures/` path segment, and
`detect_entry_points` drops every node marked `is_test`. A corpus under such a
path reports **zero** raw entry points: the same files score 0 inside
`tests/fixtures/` and 38 outside it. One of the seven numbers would then be a
constant empty digest on every run, guarding nothing.

The check is against the ABSOLUTE path, so a checkout under `~/test/…` would
collapse it too. An arm refuses a corpus root that lies inside a test tree, and
`EXPECTED_COUNTS` asserts an exact positive count for every component, so such a
move fails loudly rather than silently.

## What each file is for

Every one of the seven components is non-empty by construction.

| file | what it contributes |
| --- | --- |
| `src/entry.ts` | a module-scope call no node encloses; the corpus's live root |
| `src/registry.ts` | a collection read — `collection_read` evidence carrying a collection id |
| `src/handlers.ts` | functions reachable only through that collection |
| `src/callback.ts` | a function passed as a value — `function_reference` evidence |
| `src/unresolved.ts` | calls into `JSON` and `console` that do not resolve |
| `src/orphan.ts` | exported, never called — the raw entry points |
| `src/arithmetic.ts` | the shared callee |
| `src/aaa_first_reader.ts`, `src/zzz_second_reader.ts` | two files that both read `increment` as a value, so its reachability evidence is CONTESTED across files |
| `src/duplicate_exports.js` | exports one name twice, so indexing throws and the file is dropped |
| `tools/build_report.ts` | outside `src/`, so the two predicates differ by exactly one file |

The two readers are what let this corpus express an order-dependence at all.
Ariadne records the last writer's read site as a function's reachability
evidence, so which reader wins depends on the order the loader walked the files.
Without a symbol whose evidence is contested across files, forward and reversed
are indistinguishable and the seventh component's whole reason for existing is
invisible to the guard.

## Updating the expected fingerprint

Change the corpus, then re-derive `EXPECTED_MEMBERS` in
`../src/benchmark_corpus_load/call_graph_fingerprint.corpus.test.ts` by reading
the new source — not by pasting a run's output. The derivation test recomputes
the hashes from that list, so a list that does not match the corpus fails.
