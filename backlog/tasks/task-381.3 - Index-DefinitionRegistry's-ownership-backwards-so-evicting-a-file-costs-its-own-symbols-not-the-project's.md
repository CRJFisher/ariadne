---
id: TASK-381.3
title: "Index DefinitionRegistry's ownership backwards so evicting a file costs its own symbols, not the project's"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - performance
  - call-resolution
dependencies:
  - TASK-381.1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`DefinitionRegistry.remove_file` iterates the file's symbols and, inside that loop, runs `for (const [member_id, owner_id] of this.member_owner)` over every member in the project (`packages/core/src/resolve_references/registries/definition.ts:345`) and `for (const subtypes of this.type_subtypes.values())` over every parent set in the project (`:354`). `update_file` opens with `remove_file`, and `apply_index_and_resolve` writes definitions twice, so the project-sized scan is paid exactly twice for every indexed file.

The counterfactual, taken by counting entries in the live maps at eviction time, is the largest single number in this investigation: 70.0M scanned entries at n=200, 500.4M at n=600 and 2,178,985,276 at n=1,200, against a keyed cost of 4,693, 12,174 and 24,295 for the same evictions. The scanning term fits N^1.8-2.1 while the keyed term is exactly linear (2.00x for 2.0x the files), so the reduction factor itself grows: 14,923x, 41,109x, 89,689x.

The two scans stand in for indices that do not exist. Add `owner_members` (owner to members) and `subtype_parents` (subtype to parents), written at every site that already populates `member_owner` or `type_subtypes` — including `capture_member_aliases`, `register_type_inheritance` and the rollback path — and delete both loops. `is_subtype_registered` (`:510-523`) gets its keyed form from the same index: it currently walks every parent set matching the parent BY NAME, so the reverse index hands it the child's own parents and only those are name-matched. Missing one write site does not fail loudly — it makes eviction silently under-delete and moves call edges — so the change needs an assertion-mode invariant that rebuilds both indices from scratch and compares.

One measurement caveat the earlier plan elided. The 1.981x figure at n=1,200 was taken between two arms that BOTH carry the two-phase driver (arm B, driver without indices, against arm D, driver with them). Landing this task alone — on the incremental driver, where the eviction scan runs against a less-populated registry — will not reproduce that ratio, and the task must not be judged against it. The ratio is asserted in TASK-381.4, where the arm it was measured in exists. What is asserted here is the elimination of the scan itself, which is order-of-magnitude and arm-independent. This still must be in before or with TASK-381.4, because under the two-phase driver the eviction scan runs against a fully-populated registry and gets 1.87 to 1.90x worse, so a driver landing without these indices hands its gain straight back.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `member_owner` and `type_subtypes` each have a reverse index, neither full-scan loop remains in `remove_file`, and `is_subtype_registered` reads the child's own parents from the reverse index rather than walking every parent set in the project.
- [ ] #2 #2 Every site writing `member_owner` or `type_subtypes` writes the reverse index, and an assertion-mode invariant that rebuilds both from scratch and compares runs in the test suite.
- [ ] #3 #3 Scanned entries over a 1,200-file load fall from 2,178,985,276 to <= 50,000, against a keyed cost measured at 24,295 for the same evictions.
- [ ] #4 #4 Keyed map operations per evicted symbol at n=200, 600 and 1,200 are flat within 25% (keyed cost measured at 4,693 / 12,174 / 24,295 in total, exactly linear at 2.00x for 2.0x the files), and a counter asserts zero full-map iterations occur in any `DefinitionRegistry` eviction path.
- [ ] #5 #5 Whole-load CPU at n=200, 600 and 1,200 on the incremental driver is measured with interleaved arms in separate processes and recorded in the harness as cpu_user with cpu/wall and loadavg — no minimum ratio is asserted here, because the 1.981x figure was measured between two arms that both carry the two-phase driver and is asserted in TASK-381.4 AC #7.
- [ ] #6 #6 The six-number fingerprint is byte-identical at n=200, 600 and 1,200 — the prototype was byte-identical on entry points, nodes and edges at all three.

<!-- AC:END -->
