---
id: TASK-381.9
title: "Stamp each cache blob with its own validity so an interrupted index resumes instead of restarting"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - persistence
  - performance
dependencies:
  - TASK-381.1
  - TASK-381.4
  - TASK-381.10
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`load_project` writes each file's index blob inside the load loop but writes `manifest.json` only after the loop completes (`packages/core/src/project/load_project.ts:174-316`). A run that dies leaves thousands of finished, valid blobs and no manifest, and the next run reads a null manifest and re-indexes every one of them. Measured directly: `kill -9` eight seconds into a 200-file load left 87 valid blobs on disk and got 0 cache hits on resume, re-indexing all 200 in 13,991 ms, while self-describing blobs left 81 and got 81 hits, resuming in 9,806 ms. The vscode baseline did exactly this at scale — 6,634 usable blobs after the OOM, 0 cache hits on the retry. An eight-minute load that is interrupted currently loses 100% of its work.

The manifest is the only thing making the cache non-resumable; blob writes are already per-file and already atomic through tmp-plus-rename. Delete `packages/core/src/persistence/cache_manifest.ts` and stamp each blob with `{schema_version, indexer_version, source_path, content_hash, git_blob_hash}`, so a blob becomes a complete self-validating record the instant `rename()` lands, and `deserialize_cached_index` returns null — an ordinary cache miss — on corrupt JSON, a wrong version on either axis, a `source_path` that is not the file being asked for, or a payload that is not index-shaped.

This supersedes TASK-378, and ALL of TASK-378's requirements must be carried, not only its reasoning: the cached artefact is the output of `build_index_single_file`, so a shipped query-pattern or indexer fix must invalidate it; the version comes from the package version rather than a constant someone must remember to bump (`CURRENT_SCHEMA_VERSION` stands at 5 today, not the 4 TASK-378's text records); the two axes invalidate independently; the granularity decision is documented; and superseded version directories are swept on first use. Making the blob directory `<cache>/indexes/<indexer_version>/` gives that sweep an enumeration unit — without it every upgrade permanently leaks a full cache copy, measured at roughly 2.1 GB per cached vscode checkout.

The cache is also fifty times the size of the source it describes: 218.06 MB of blobs for 4.35 MB of source across 364 files. References are 79.5% of all bytes and the blob's own source path, repeated twice in every `SymbolReference` record, is 56.5% of them. Storing it once in the header and eliding it from every record measured 68.56 MB down to 29.56 MB (2.32x) and `JSON.parse` 205.4 ms down to 166.1 ms (1.24x) over 120 blobs across 5 interleaved reps — roughly 4.9 GB to 2.1 GB of the user's home directory per cached vscode checkout. Restoring a file is already 13.0x cheaper than indexing it (3.10 ms against 40.4 ms), so the ceiling is blob size and not deserialisation: do not optimise `deserialize_semantic_index`.

Three things leave with the manifest and two invariants have to be written down. Pruning entries for deleted files only ever pruned manifest rows and never deleted a blob, so orphans already leak — a planted unreachable blob and a stray `.tmp` both survived a full warm load untouched — and the sweep that replaces it must run only on a full-corpus load, because a files- or folders-scoped load that sweeps deletes the rest of the project's cache. The manifest-era layout is deleted outright on first run, not read by a compatibility path. The git-fast-path entry upgrade is unnecessary, since a file indexed while dirty and later committed still restores on its content hash. And the blob is atomic for readers but not durable across power loss, there being no `fsync`; the current comment claims more than it delivers and should stop.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `cache_manifest.ts` and its test are deleted, and no `read_manifest` or `write_manifest` remains on the `PersistenceStorage` contract.
- [ ] #2 #2 Each blob carries `{schema_version, indexer_version, source_path, content_hash, git_blob_hash?}`, `indexer_version` is sourced from the package version, a mismatch on either version axis independently rejects the blob, and blobs live under `<cache>/indexes/<indexer_version>/`.
- [ ] #3 #2a The manifest-era cache layout is deleted outright on first run of the new build — no reader, no migration, no fallback path (NO BACKWARDS COMPATIBILITY); a test proves a pre-existing `manifest.json` and its blobs are removed rather than orphaned forever.
- [ ] #4 #3 `deserialize_cached_index` returns null rather than throwing on corrupt, non-index-shaped, or wrong-`source_path` payloads.
- [ ] #5 #4 `kill -9` eight seconds into a 200-file load, then restart: every blob written before the kill is a cache hit — 160 of 160 measured, against 0 of 160 on an interleaved control arm from the tree immediately before — 0 orphan `.tmp` files remain, and the fingerprint matches an uninterrupted cold load byte for byte AT THE SAME INGEST ORDER. Cross-order equality is TASK-381.11's criterion, not this one.
- [ ] #6 #5 The source path is stored once per blob and elided from every `SymbolReference` record. REFUTED IN ITS FIGURES, MET IN ITS MECHANISM: blob bytes over a 120-blob sample fall 83.96 -> 49.56 MB (1.694x), NOT to the 32 MB budgeted, and no elision of the path could have reached it — removing the path from the whole blob, definitions and scopes included, floors at 38.21 MB on this tree. The 68.56 MB the target was set against is a smaller index than this tree produces. `JSON.parse` falls 208.1 -> 174.3 ms, meeting the 175 ms bound, and the 205.4 ms control figure reproduces to 1.3%.
- [ ] #7 #6 Warm cache hits equal the number of files offered minus the number dropped, at n=50, 200, 400 and 800 — measured 50/200/400/800 hits against an empty dropped set at every size, so the ceiling this criterion was written against (92.9% on a tree with drops) no longer binds.
- [ ] #8 #7 A full cache that matches nothing costs <= +6% CPU against cold. MEASURED +2.94% at 1.21 ms per rejected blob, five reps interleaved A,B,A,B in one process at 800 files, against a control that indexes and writes the same 800 blobs and reads none. A control that writes nothing reads +25.4%, because it charges the rejection with the cost of populating a cache.
- [ ] #9 #8 Orphan blobs are swept only on a full-corpus load, and a test proves a folder-scoped load deletes nothing outside its own scope.
- [ ] #10 #8a Superseded `<cache>/indexes/<indexer_version>/` directories are removed on first use and the current one is retained — TASK-378 AC #3 carried forward — and a test proves an upgrade leaves exactly one version directory.
- [ ] #11 #8b The chosen cache granularity (per-project or global) is stated in the persistence module documentation — TASK-378 AC #5 carried forward — since the sweep behaviour follows from it.
- [ ] #12 #9 A test proves the indexer-version effect end to end: with a warm cache and unchanged source, a change to indexing produces changed output rather than replaying the stale index.
- [ ] #13 #10 TASK-378 is closed as superseded, with each of its six acceptance criteria mapped to the criterion here that carries it, so no follow-up re-adds a manifest to carry the same axis; and `persistence/*.test.ts` and the cache-restore paths in `project/project.test.ts` stay green.
- [ ] #14 #11 The `fsync` claim is removed from the atomicity comment: the blob is atomic for readers and not durable across power loss, and the comment says exactly that.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### What a user gets

An interrupted run is no longer a total loss. Killing a 200-file load eight
seconds in leaves 160 finished blobs, and the restart reuses every one of them
and indexes the remaining 40 — against 0 of the same 160 on the tree
immediately before, measured in the same session on the same corpus. The
resumed run reports a call graph identical to an uninterrupted cold load's, all
seven fingerprint components digest for digest.

A user who upgrades now receives what they upgraded for. A blob carries the
build of the indexer that produced it, so a shipped query-pattern fix
invalidates every cached index rather than replaying pre-fix answers over
unchanged source.

A cached checkout costs the user's home directory 0.590 of what it did: the
source path is stored once per blob instead of two or three times in every
reference record.

### Shape

`persistence/cached_index.ts` is the blob format — the stamp and the index it
validates, written as one document so a partial write is unreadable rather than
trusted. `persistence/indexer_version.ts` reads the package version.
`persistence/source_path_elision.ts` removes the blob's own path from every
reference record on write and puts it back on read, exactly.
`FileSystemStorage` stores blobs under `<cache>/indexes/<indexer_version>/`,
deletes every other layout on first use, and gains `sweep(live_paths)` on the
`PersistenceStorage` contract in place of `read_manifest`/`write_manifest`.
`load_project` reads and validates per file inside pass A and sweeps once at the
end, only when no `files` or `folders` filter narrowed the corpus.
`packages/core/src/persistence/README.md` is the module's documentation:
per-project granularity, the two version axes, both sweeps, and what the
atomicity does and does not promise.

`serialize_semantic_index` left the production surface with the manifest — a
cached index is embedded in its stamp rather than stringified alone — and now
lives in `serialize_index.test.ts` as the round-trip helper its remaining
callers use.

### The figures, and the one that is refuted

`RECORDED_CACHE_RESUMPTION` holds every arm, and the benchmark README carries
the prose. Measured on ariadne@ded8a2ca plus this change, Darwin 24.6.0 x64, 6
cores, node v22.22.1, over microsoft/vscode at f3fa55c3.

The blob-size target is refuted rather than met, and the refutation is
checkable: 49.56 MB against a 32 MB budget, over a control arm of 83.96 MB in
the same process. Removing the path from the WHOLE blob — definitions, scopes
and map keys included — floors at 38.21 MB, so no elision of the path could have
reached 32 on this tree. The 68.56 MB the target was set against describes a
smaller index than this tree produces; the parse figure from the same
investigation reproduces to 1.3% (205.4 ms recorded, 208.1 measured), which is
what says the gap is the index's growth and not the measurement. The parse bound
is met at 174.3 ms.

The remaining 11.32 MB of path bytes in the 120-blob sample sit outside
reference records, in the `SymbolId` and `ScopeId` map keys of the definition
and scope collections. Taking those is a larger change than this criterion
specifies and is left open.

<!-- SECTION:NOTES:END -->
