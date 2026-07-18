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

That whitelist is for genuine external API only. Do not silence a genuinely-dead symbol by
adding it — delete the symbol. Two sharp edges: the whitelist matches on symbol **name**
alone, so a broad name (`run`, `main`, `handle`) silences every collision in the package;
and a package with no whitelist file gets an empty set, so every entry point there blocks.

The barrel clauses above are unenforced today — they are review-carried.
