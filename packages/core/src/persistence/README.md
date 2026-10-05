# The index cache

A cached index is the output of `build_index_single_file` for one source file,
stored so that a later load of the same file skips tree-sitter entirely.
Restoring a file costs a fraction of indexing it, so the cache is what decides
whether a second run over a large repository takes minutes or an hour.

## Granularity: one cache per project, one blob per file

The cache is **per project**, keyed by the absolute project path:
`~/.ariadne/cache/<basename>-<8-char-sha256>/`. `ARIADNE_CACHE_DIR` overrides the
location outright, and the values `off`, `none`, `false` and `0` disable caching.

Per-project is what makes the orphan sweep possible. A load of the whole project
knows the complete file set, so a blob for a file outside it is dead weight and
is deleted. A global cache would hold blobs for every project the user has ever
opened, and no single load could ever tell an orphan from a file belonging to
some other project.

Inside a project's cache, the unit is **one blob per source file**, named by the
SHA-256 of the source path. Per-file is what makes an interrupted load
resumable: the blob lands atomically, so every file a killed run finished is a
cache hit for the next one. Measured over 200 files with `kill -9` eight seconds
in, the restart reused all 160 blobs the killed run had written.

## The layout

```text
<cache_dir>/
  indexes/
    <indexer_fingerprint>/
      <sha256-of-source-path>.json
```

The fingerprint directory gives an indexer change something to enumerate. Blobs
written by a different indexer build are unreadable rather than merely stale, so
on first use every entry under `indexes/` that is not this build's fingerprint is
deleted, along with anything else at the cache root. There is no reader for
another build's blobs and no migration: an indexer change costs a re-index,
never a leaked copy of the cache.

## What makes a blob valid

Each blob carries its own stamp, and a reader that cannot match every field
treats the blob as absent and re-indexes the file. Nothing consults a
project-wide list first, which is precisely why an interrupted run leaves a
usable cache.

| field                 | rejects when                                                      |
| --------------------- | ----------------------------------------------------------------- |
| `indexer_fingerprint` | a different build of the indexer produced the blob                |
| `source_path`         | the blob describes a file other than the one the reader asked for |
| `content_hash`        | the file's current content is not what the index was built from   |
| `git_blob_hash`       | git no longer names the content the index was built from          |

A blob is the output of code, not a transcription of the file: the parse, the
query patterns, the capture handlers, the scope extractors, the definition
builders and the serializer that writes it. `indexer_fingerprint` is a hash of
exactly that code, computed from the running build in `indexer_fingerprint.ts`:

- every module in the import closure of `project/parse_file`,
  `index_single_file/index_single_file` and `persistence/cached_index`, found
  by parsing each module's imports and requires with tree-sitter;
- the `.scm` queries in `index_single_file/query_code_tree/queries`;
- the modules of any workspace package the closure imports, such as
  `@ariadnejs/types`, followed as code;
- the name and version of every installed package the closure reaches — the
  tree-sitter binding and its grammars.

A change to what indexing extracts, or to the shape a blob is written in, edits
one of those files and so moves the fingerprint on the next build, whether or
not a release carries it. A change to resolution, the call graph or
classification touches none of them and leaves the cache warm.

The fingerprint names files by package and package-relative path, so the same
build checked out at two locations fingerprints identically. It is computed
once per process, the first time a storage is opened or a blob is read.

`content_hash` and `git_blob_hash` are the two ways of asking whether the file
changed. Git answers without reading the file, and answers per blob, because a
staged edit and a committed edit both leave the working tree clean while the
content differs from what was cached. A file git cannot vouch for — dirty,
untracked, or indexed while it was one of those — falls back to hashing the
content the load has already read.

## The source path is stored once

A reference record names its own file two or three times over — in its
`location`, inside its `scope_id`, and again in whichever receiver, assignment
target or type it carries. Reference records are 76.8% of a blob's bytes and the
repeated path is 53.4% of those. The blob header holds the path once and every
reference record has it elided, which takes a 120-blob sample from 83.96 MB to
49.56 MB and its `JSON.parse` from 208.1 ms to 174.3 ms.

The transform is exact, not lossy. A restored index compares equal record for
record to the one that was written, so a file served from cache and a file
indexed cold produce the same call graph — measured as a byte-identical
seven-component fingerprint over the 200-file resume arm.

## Sweeping

Two sweeps run, and both are deletions with no reader on the other side.

**Superseded layouts**, on first use of a `FileSystemStorage`: every entry under
`indexes/` except this build's fingerprint directory, and the cache root's
manifest if one is there.

**Orphan blobs**, at the end of a load of the whole project: every blob in the
current fingerprint directory whose source file is not in the corpus, plus any
temporary file an interrupted write left behind. This runs only for a load with
no `files` or `folders` filter. A scoped load sees a fraction of the corpus, so
every blob outside its scope looks exactly like an orphan, and sweeping there
would delete the rest of the project's cache and turn the next full load cold.

## Atomicity, and what it is not

A blob is written to a temporary file in the target directory and renamed into
place. `rename()` is atomic on POSIX when source and target share a filesystem,
so a reader sees the whole blob or none of it.

Nothing is fsynced. The blob is atomic **for readers** and is not durable across
power loss: a machine that loses power mid-load can lose a write that a killed
process would have kept.
