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

`.claude/hooks/detect_dead_code.ts` (Stop) loads each git-modified package with Ariadne and
blocks on any call-graph entry point absent from `.claude/known_entrypoints/<package>.json`.
Call-graph reachability is its proxy for the first rule above: an exported symbol nothing
calls surfaces as an entry point.

When it blocks, delete the symbol. Add to the whitelist only for genuine external API — it
matches on symbol name alone, so a broad name silences every collision in the package.

The barrel rules are review-carried.
