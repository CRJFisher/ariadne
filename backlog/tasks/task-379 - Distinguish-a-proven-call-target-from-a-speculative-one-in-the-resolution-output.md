---
id: TASK-379
title: "Distinguish a proven call target from a speculative one in the resolution output"
status: To Do
assignee: []
created_date: "2026-07-30 14:10"
labels:
  - call-resolution
  - polymorphic_dispatch
  - comparative-analysis
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A user asking "what calls this?" cannot tell a proven caller from a speculative one. Ariadne deliberately over-approximates polymorphic dispatch — a call through an interface resolves to the base plus every transitive subtype override — which is the right choice for entry-point detection, because under-approximating invents false entry points. But the twelve edges that fan out from one call site are presented exactly like the one direct same-file call next to them. So a blast-radius question ("what breaks if I change this?") reads twelve real callers where there is one certain and eleven possible, and there is no field a consumer can weight or filter on.

The distinction is already computed. It is discarded on the way out.

## Root cause

`ResolutionConfidence` declares `certain | probable | possible` (`packages/types/src/resolution.ts:11-14`) and `Resolution.confidence` carries it (`:35`). Both producers hardcode it: `call_resolver.ts:376` and `:493` each write `confidence: "certain" as const`. Grepping `.confidence` across `packages/*/src` returns **no consumers at all** — the field is a dead payload written by two sites and read by none.

The information the field should carry is live at the point it is written. `call_resolver.ts:366-368` computes `is_interface_impl` (`call_type === "method" && resolved_symbols.length > 1`) immediately above the `resolutions.map` that hardcodes the confidence, and already branches on it to pick the `ResolutionReason`. A polymorphic fan-out is therefore distinguishable from a direct resolution one line before the distinction is thrown away.

The same block carries a second discard: the `interface_implementation` reason is built with `interface_id: "unknown" as SymbolId` (`:380`), so even the structured reason cannot name which interface the fan-out came from. That is the only `"unknown" as SymbolId` in non-test source.

Graphify persists the equivalent signal end to end — every edge carries `EXTRACTED`/1.0 or `INFERRED`/0.8, a name-matched cross-file call is _promoted_ to EXTRACTED when the caller's file demonstrably imports the target (`graphify/extract.py:5374-5382`, `:5452-5468`), and the split surfaces in its report and its MCP audit resource. It demonstrates that the shape is worth carrying to the user, which is the part Ariadne is missing rather than the values themselves.

## Work plan

1. **Populate confidence at both producers.** In `call_resolver.ts:369-382`, a direct resolution stays `certain`; a member of a polymorphic fan-out is not certain, since at most one of the set runs at any call site. Choose between `probable` and `possible` on a stated rule — the declaring/base target is a stronger claim than a subtype override, so they need not share a level — and record the rule in the `ResolutionConfidence` doc comment so the enum documents its own contract. `call_resolver.ts:493` (callback invocation) resolves a single known callable and stays `certain`.
2. **Thread the real interface id** into the `interface_implementation` reason, replacing `"unknown" as SymbolId` at `:380`. The polymorphic resolution path knows which type it fanned out from; carry it rather than erasing it.
3. **Surface the distinction where the fan-out is shown.** The MCP call-graph tools are where a user meets these edges; a resolution set that is one certain plus eleven possible must not read as twelve equals. Presentation only — the resolution set itself is unchanged, and entry-point detection continues to consume the full over-approximation exactly as today.

## Explicitly not in scope

Narrowing the fan-out. Over-approximation is correct for the top-level intention — a missed edge invents a false entry point — and this task changes what the output _says_ about each edge, never which edges exist.

## Tests

- A direct same-file call carries `certain`; a call through an interface with three implementations carries the fan-out level on the overrides, and the set is unchanged in size and membership.
- The `interface_implementation` reason names the real interface id, with no `"unknown"` sentinel remaining in non-test source.
- Entry-point results are byte-identical before and after, over the four language integration suites — the pin that this is an output-annotation change and not a resolution change.
- `call_resolver.test.ts` and the `project/*.integration.test.ts` suites stay green.

## Provenance

Identified by comparing Ariadne against Graphify (`~/workspace/tools/graphify`). Every citation verified against source on 2026-07-30.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Both producers in `call_resolver.ts` set `confidence` from the resolution's actual basis; no `confidence: "certain" as const` literal remains.
- [ ] #2 The rule assigning each `ResolutionConfidence` level is stated in the doc comment on the type in `packages/types/src/resolution.ts`.
- [ ] #3 The `interface_implementation` reason carries the real interface `SymbolId`, and `"unknown" as SymbolId` appears nowhere in non-test source.
- [ ] #4 The MCP call-graph output distinguishes a proven target from a speculative one, so a twelve-way fan-out no longer reads as twelve equal callers.
- [ ] #5 Resolution sets are unchanged in size and membership, and entry-point results are identical before and after across the four language integration suites.
- [ ] #6 `call_resolver.test.ts` and the `project/*.integration.test.ts` suites stay green.

<!-- AC:END -->
