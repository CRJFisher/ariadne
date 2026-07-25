---
paths: packages/*/src/**
---

# Surplus Code

Surplus code is a liability: every exported symbol widens the surface a reader must hold.

- An exported symbol needs at least one non-test consumer outside its own file. None means
  delete it — never export "for later".
- A barrel (`index.ts`) re-exports only its own folder's surface, never a sibling's.
- A barrel with zero exports, or zero importers, is deleted.

## Hook Enforcement

`.claude/hooks/detect_dead_code.ts` (Stop) loads every package whose `src/**.ts` changed with
Ariadne and blocks on any call-graph entry point absent from
`.claude/known_entrypoints/<package>.json`. Call-graph reachability is its proxy for the first
rule above: an exported symbol nothing calls surfaces as an entry point.

A change counts whether it is committed, staged, unstaged, or untracked. The scan runs from
the last commit the hook cleared, recorded at `<git-dir>/ariadne_dead_code_scan_base` — git
keeps that directory per-worktree, so each worktree tracks its own cleared point, and a
worktree with no mark of its own falls back to the main checkout's. A mark left on a history
HEAD cannot reach resolves to the fork point rather than being discarded. The mark advances
only after a run that analysed every package in scope and found nothing, so a blocked,
failed, or killed run re-covers its range.

With no mark on record every tracked file is in scope, so deleting the mark forces a full
rescan. In a linked worktree delete the shared one too, or the fallback supplies it:

```bash
rm -f "$(git rev-parse --absolute-git-dir)/ariadne_dead_code_scan_base" \
      "$(git rev-parse --path-format=absolute --git-common-dir)/ariadne_dead_code_scan_base"
```

When it blocks, delete the symbol. Add to the whitelist only for genuine external API — it
matches on symbol name alone, so a broad name silences every collision in the package.

The barrel rules are review-carried.
