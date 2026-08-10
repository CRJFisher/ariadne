/**
 * `AriadneFaultArea` — the folder-anchored taxonomy of "which part of Ariadne is
 * at fault" when a function is wrongly flagged as an entry point (a triage
 * false-positive). The `plan` engine groups false-positives by area and routes
 * each fix to the owning core folder.
 *
 * The area is a DERIVED VIEW, computed-on-read by `derive_fault_area` from the
 * deterministic fault signal core already emits — `EntryPointDiagnostics`'
 * `diagnosis` plus the per-call `ResolutionFailure {stage, reason}`. It is never
 * stored: the only persisted fault signal remains `diagnosis` + `resolution_failure`.
 * A core IA refactor therefore edits only `ARIADNE_FAULT_AREA_FOLDER`, never any
 * stored data.
 *
 * `other` is the escape hatch: a signal that matches no folder-anchored area
 * (a forward-incompatible `(stage, reason)`/`diagnosis` core emits but this
 * package does not yet know, or a resolver that returned empty without a
 * diagnostic) routes here carrying a free-text `description`. The `plan` engine
 * reads that description to both extend this taxonomy and plan the underlying fix.
 */

import type {
  ResolutionFailureReason,
  ResolutionFailureStage,
} from "./resolution_failure.js";
import type { Language } from "./location.js";
import type { EntryPointDiagnosis } from "./entry_point.js";

/**
 * The fault areas, each anchored 1:1 to a core folder via
 * `ARIADNE_FAULT_AREA_FOLDER`, plus the `other` escape hatch.
 *
 * - `syntactic_extraction`       query/capture never produced the call site.
 * - `scope_construction`         malformed/missing scope tree.
 * - `name_resolution`            in-scope name lookup failed.
 * - `import_resolution`          cross-file import/re-export linking failed.
 * - `receiver_type_inference`    receiver/member type lost.
 * - `method_lookup`              type known, member absent.
 * - `polymorphic_dispatch`       interface receiver, no implementations.
 * - `collection_dispatch`        value-in-collection / dynamic key.
 * - `coverage_config`            call sites live in excluded (unindexed) files.
 * - `entry_point_classification` resolution succeeded but the function is still flagged.
 * - `other`                      escape hatch; carries `description`, `needs_judgement`.
 */
export type AriadneFaultArea =
  | "syntactic_extraction"
  | "scope_construction"
  | "name_resolution"
  | "import_resolution"
  | "receiver_type_inference"
  | "method_lookup"
  | "polymorphic_dispatch"
  | "collection_dispatch"
  | "coverage_config"
  | "entry_point_classification"
  | "other";

/**
 * Repo-relative POSIX path of the core module that owns each fault area — the
 * fix-routing target the `plan` engine sends a group to. Separate from the value
 * list so a core IA refactor updates only this map. `other` has no owning module
 * (escape hatch) and maps to the empty string.
 *
 * Being a `Record<AriadneFaultArea, string>`, a new area added to the union is a
 * missing-key compile error here until its folder is named.
 */
export const ARIADNE_FAULT_AREA_FOLDER: Record<AriadneFaultArea, string> = {
  syntactic_extraction: "packages/core/src/index_single_file/query_code_tree",
  scope_construction: "packages/core/src/index_single_file/scopes",
  name_resolution: "packages/core/src/resolve_references/name_resolution.ts",
  import_resolution: "packages/core/src/resolve_references/import_resolution",
  receiver_type_inference:
    "packages/core/src/resolve_references/call_resolution/receiver_resolution.ts",
  method_lookup:
    "packages/core/src/resolve_references/call_resolution/method_lookup.ts",
  polymorphic_dispatch:
    "packages/core/src/resolve_references/call_resolution/method_lookup.ts",
  collection_dispatch:
    "packages/core/src/resolve_references/call_resolution/collection_dispatch.ts",
  coverage_config: "packages/core/src/project",
  entry_point_classification: "packages/core/src/classify_entry_points",
  other: "",
};

/** String-form enumeration of `AriadneFaultArea`, derived from the folder map. */
export const ARIADNE_FAULT_AREAS: readonly AriadneFaultArea[] = Object.keys(
  ARIADNE_FAULT_AREA_FOLDER,
) as AriadneFaultArea[];

export function is_ariadne_fault_area(s: string): s is AriadneFaultArea {
  return Object.prototype.hasOwnProperty.call(ARIADNE_FAULT_AREA_FOLDER, s);
}

/**
 * The derived fault location for one triage false-positive. Computed-on-read by
 * `derive_fault_area`; never persisted.
 *
 * - `resolution_stage`/`resolution_reason` are echoed from the input when the
 *   derivation went through the `(stage, reason)` path and the values are known
 *   enum members; absent on the `diagnosis`-fallback and escape-hatch paths.
 * - `language` marks the fault as language-specific (e.g. a JS getter/setter
 *   extraction gap, a Rust enum-impl miss) — a grouping signal for the `plan`
 *   engine. Echoed from the input when the caller supplies it.
 * - `description` is the escape-hatch free-text: present (non-empty) iff
 *   `area === "other"`, absent otherwise.
 */
export interface AriadneFaultLocation {
  readonly area: AriadneFaultArea;
  readonly resolution_stage?: ResolutionFailureStage;
  readonly resolution_reason?: ResolutionFailureReason;
  readonly language?: Language;
  readonly needs_judgement: boolean;
  readonly description?: string;
}

/**
 * Raw fault signal for one false-positive, as it arrives from disk. `stage`,
 * `reason`, and `diagnosis` are plain strings (not the typed unions) so a
 * forward-incompatible value core emits routes to the `other` escape hatch at
 * runtime rather than being a type error — while the internal tables stay
 * exhaustive over the known enums (a new enum member in code is a compile error).
 */
export interface DeriveFaultAreaInput {
  /** The per-call `ResolutionFailure`, or `null` when the resolver emitted none. */
  readonly resolution_failure: { readonly stage: string; readonly reason: string } | null;
  readonly diagnosis: string;
  readonly has_uncaptured_indexed_grep_hit: boolean;
  /** Set by the caller when the fault is known to be language-specific. */
  readonly language?: Language;
}

/**
 * `(stage, reason) → area`, keyed on `reason`. `method_not_on_type` is the only
 * reason whose AREA depends on the emitting stage (receiver-side inference vs
 * direct member lookup) and is resolved by stage in `derive_fault_area`. Several
 * other reasons are emitted from more than one stage (e.g. `name_not_in_scope`,
 * `no_parent_class`, `collection_dispatch_miss`), but every stage they fire from
 * maps to the SAME area, so keying on reason alone is correct for them. Verified
 * against the core emit sites.
 *
 * Being a `Record<ResolutionFailureReason, AriadneFaultArea>`, a new reason added
 * to the source enum is a missing-key compile error here until it is mapped.
 */
const REASON_TO_AREA: Record<ResolutionFailureReason, AriadneFaultArea> = {
  name_not_in_scope: "name_resolution",
  import_unresolved: "import_resolution",
  reexport_chain_unresolved: "import_resolution",
  receiver_type_unknown: "receiver_type_inference",
  method_not_on_type: "receiver_type_inference", // default; stage `method_lookup` overrides
  polymorphic_no_implementations: "polymorphic_dispatch",
  collection_dispatch_miss: "collection_dispatch",
  dynamic_dispatch: "collection_dispatch",
  no_enclosing_class_scope: "scope_construction",
  class_definition_not_found: "scope_construction",
  no_parent_class: "scope_construction",
  member_type_unknown: "receiver_type_inference",
  definition_has_no_body_scope: "scope_construction",
  constructor_target_not_a_class: "method_lookup",
};

/** Stage lookup, derived to narrow raw input strings to the typed union. */
const RESOLUTION_FAILURE_STAGE_SET: Record<ResolutionFailureStage, true> = {
  name_resolution: true,
  receiver_resolution: true,
  method_lookup: true,
  import_resolution: true,
  type_inference: true,
  constructor_lookup: true,
  collection_dispatch: true,
};

function is_resolution_failure_reason(s: string): s is ResolutionFailureReason {
  return Object.prototype.hasOwnProperty.call(REASON_TO_AREA, s);
}

function is_resolution_failure_stage(s: string): s is ResolutionFailureStage {
  return Object.prototype.hasOwnProperty.call(RESOLUTION_FAILURE_STAGE_SET, s);
}

const ENTRY_POINT_DIAGNOSIS_SET: Record<EntryPointDiagnosis, true> = {
  "no-textual-callers": true,
  "callers-not-in-registry": true,
  "callers-in-registry-unresolved": true,
  "callers-in-registry-wrong-target": true,
  "callers-outside-indexed-corpus": true,
  "references-without-call-syntax": true,
};

function is_entry_point_diagnosis(s: string): s is EntryPointDiagnosis {
  return Object.prototype.hasOwnProperty.call(ENTRY_POINT_DIAGNOSIS_SET, s);
}

function other_location(description: string, language?: Language): AriadneFaultLocation {
  return { area: "other", language, needs_judgement: true, description };
}

/**
 * Derive the fault area for one false-positive — a pure, total function.
 *
 * Precedence: the per-call `ResolutionFailure` is the most specific signal and
 * is consulted first; the `diagnosis` is the fallback when no failure was
 * emitted. The coverage gap needs no precedence hack any more — a caller in a
 * discovered-but-unindexed file states itself as `callers-outside-indexed-corpus`
 * rather than masquerading as `no-textual-callers`. Unknown raw values route to
 * the `other` escape hatch.
 *
 * Residual-judgement cases return a deterministic default with
 * `needs_judgement: true` (the `plan` strategist decides):
 *   1. `callers-not-in-registry` with a captured-but-lost indexed hit → `syntactic_extraction`.
 *   2. `callers-in-registry-unresolved` with no `resolution_failure` → `other`.
 *   3. `no-textual-callers` (genuine entry point vs classification miss) → `entry_point_classification`.
 *   4. `collection_dispatch_miss` (may re-route to `import_resolution`) → `collection_dispatch`.
 */
export function derive_fault_area(input: DeriveFaultAreaInput): AriadneFaultLocation {
  const { resolution_failure, diagnosis, language } = input;

  // Precedence 1: the per-call resolution failure (most specific).
  if (resolution_failure !== null) {
    const { stage, reason } = resolution_failure;
    if (!is_resolution_failure_reason(reason)) {
      return other_location(
        `unrecognized resolution_failure reason "${reason}" at stage "${stage}"`,
        language,
      );
    }
    const known_stage = is_resolution_failure_stage(stage) ? stage : undefined;

    if (reason === "method_not_on_type") {
      // The sole stage-ambiguous reason: member absent on the receiver's type
      // (receiver-side inference) vs absent during direct member lookup.
      if (known_stage === undefined) {
        return other_location(
          `method_not_on_type at unrecognized stage "${stage}" — cannot tell receiver inference from method lookup`,
          language,
        );
      }
      const area: AriadneFaultArea =
        known_stage === "method_lookup" ? "method_lookup" : "receiver_type_inference";
      return {
        area,
        resolution_stage: known_stage,
        resolution_reason: reason,
        language,
        needs_judgement: false,
      };
    }

    return {
      area: REASON_TO_AREA[reason],
      resolution_stage: known_stage,
      resolution_reason: reason,
      language,
      // Residual case 4: the true root cause may be an upstream unresolved import.
      needs_judgement: reason === "collection_dispatch_miss",
    };
  }

  // Precedence 2: the summary diagnosis (fallback).
  if (!is_entry_point_diagnosis(diagnosis)) {
    return other_location(`unrecognized diagnosis "${diagnosis}"`, language);
  }

  switch (diagnosis) {
    case "no-textual-callers":
      // Residual case 3: genuine entry point vs true-positive classification miss.
      return { area: "entry_point_classification", language, needs_judgement: true };
    case "callers-outside-indexed-corpus":
      // A determinate statement, not a judgement: the caller exists in a file we
      // chose not to, or failed to, index.
      return { area: "coverage_config", language, needs_judgement: false };
    case "references-without-call-syntax":
      // Residual case 5: the only mentions are non-call references, which is
      // the classifier-author surface — but the reference index keys on the
      // name's final segment, not on a resolved symbol, so a same-named member
      // elsewhere can supply the evidence. The AREA is right; whether these
      // particular sites reach THIS member still needs a look. Drops to
      // `needs_judgement: false` once the sites carry symbol identity.
      return { area: "entry_point_classification", language, needs_judgement: true };
    case "callers-in-registry-wrong-target":
      return { area: "entry_point_classification", language, needs_judgement: false };
    case "callers-in-registry-unresolved":
      // Residual case 2: resolver returned empty without emitting a diagnostic —
      // itself an Ariadne defect; file a task to add the missing emit.
      return other_location(
        "callers-in-registry-unresolved with no resolution_failure: the resolver returned empty without emitting a diagnostic (Ariadne defect — missing emit)",
        language,
      );
    case "callers-not-in-registry":
      if (input.has_uncaptured_indexed_grep_hit) {
        // The query never captured the call site — a deterministic extraction gap.
        return { area: "syntactic_extraction", language, needs_judgement: false };
      }
      // Residual case 1: a `CallReference` was produced at every indexed hit yet
      // none reached the registry — ambiguous, defaults to extraction.
      return { area: "syntactic_extraction", language, needs_judgement: true };
    default: {
      const _exhaustive: never = diagnosis;
      return _exhaustive;
    }
  }
}
