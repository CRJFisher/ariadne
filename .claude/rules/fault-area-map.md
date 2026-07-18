---
paths:
  - packages/core/src/**
  - packages/types/src/ariadne_fault_area.ts
---

# Fault Area Map

Moving, splitting, or renaming a file under `packages/core/src`? Check whether its path is a
value in `ARIADNE_FAULT_AREA_FOLDER` (`packages/types/src/ariadne_fault_area.ts`) and
re-point that value to the surviving owner in the same change. Otherwise this rule does not
apply.

The map pins each `AriadneFaultArea` to one core path — where the plan pipeline routes a
triage false positive. A split is the risky case: `method_lookup.ts` owns two areas
(`method_lookup` and `polymorphic_dispatch`), so splitting it breaks both targets.

Enforcement: `build_stop.ts` (Stop) rebuilds each modified package with `tsc`, so a missing
key in the `Record<AriadneFaultArea, string>` fails the build. A value naming a deleted path,
and wrong-owner-after-split, are review-carried.
