---
paths:
  - "packages/core/src/**"
  - "packages/types/src/ariadne_fault_area.ts"
---

# Fault Area Map

`ARIADNE_FAULT_AREA_FOLDER` in `packages/types/src/ariadne_fault_area.ts` pins each
`AriadneFaultArea` to exactly one core path — the fix-routing target the plan pipeline sends
a triage false positive to.

When a change moves, splits, or renames a path that is a value in that map, re-point the
value to the surviving owner in the same change. Values are a mix of folders and single
files, so a file split is the risky case: `method_lookup.ts` owns two areas
(`method_lookup` and `polymorphic_dispatch`), and splitting it breaks both routing targets.

Enforcement: `build_stop.ts` (Stop) runs the typecheck, so a missing key in the
`Record<AriadneFaultArea, string>` fails the build. A value that still compiles while naming
a deleted path is caught only by review until the doc-truth Stop hook (TASK-362.13) lands,
and wrong-owner-after-split is human judgement either way.
