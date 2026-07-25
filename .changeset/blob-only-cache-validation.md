---
"@ariadnejs/core": patch
---

Validate cached per-file indexes against the git blob alone.

A cached index was reused whenever the HEAD tree hash was unchanged and the file
was not dirty. A staged or committed edit satisfies both conditions while the
file's content differs from what was indexed, so `load_project` served an index
built from earlier content. Validity now rests on comparing the file's current
blob hash to the blob the entry was built from, and an index built from dirty or
untracked content no longer claims a blob at all.

The cache schema version is bumped, so existing caches are discarded and the next
load re-indexes once.
