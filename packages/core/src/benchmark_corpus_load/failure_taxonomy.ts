/**
 * Where every call reference a load produced ended up: resolved, or failed for
 * one named reason.
 *
 * The seven-number fingerprint says HOW MANY call sites the resolver could not
 * place; this says WHY, reason by reason, over the same call references — every
 * CallReference of every indexed file, read from the resolution registry the
 * way `fingerprint_call_graph` reads it, so the two never describe different
 * call universes. `resolved + Σ by_reason === call_references` is the invariant
 * `call_resolver` upholds per reference, and a taxonomy that does not close is
 * a resolver exit that recorded nothing, which is refused here rather than
 * summed over.
 *
 * `by_reason` carries every reason the vocabulary names, zero included, so a
 * recorded row and a live arm always have the same keys, and a reason that
 * appears for the first time reads as a delta rather than a new column.
 */

import {
  location_key,
  type FilePath,
  type ResolutionFailureReason,
} from "@ariadnejs/types";
import type { CallSource } from "./call_graph_fingerprint";

/**
 * Every reason `ResolutionFailureReason` names, in the order the union declares
 * them so the two files diff against each other. The type is a union with no
 * runtime form, and a taxonomy needs to enumerate the keys it holds at zero.
 */
export const RESOLUTION_FAILURE_REASONS = [
  "name_not_in_scope",
  "import_unresolved",
  "reexport_chain_unresolved",
  "receiver_type_unknown",
  "method_not_on_type",
  "polymorphic_no_implementations",
  "collection_dispatch_miss",
  "dynamic_dispatch",
  "no_enclosing_class_scope",
  "class_definition_not_found",
  "no_parent_class",
  "member_type_unknown",
  "definition_has_no_body_scope",
  "constructor_target_not_a_class",
] as const satisfies readonly ResolutionFailureReason[];

// A reason added to the vocabulary and not to the list above would be counted
// under no key: this fails to compile until the list names it.
type UnlistedReason = Exclude<
  ResolutionFailureReason,
  (typeof RESOLUTION_FAILURE_REASONS)[number]
>;
const EVERY_REASON_LISTED: [UnlistedReason] extends [never] ? true : never =
  true;
void EVERY_REASON_LISTED;

export interface FailureTaxonomy {
  /** Every CallReference of every indexed file, callback invocations included. */
  readonly call_references: number;
  /** Those carrying at least one target. */
  readonly resolved: number;
  /** Those carrying none, by the reason the resolver recorded. Every reason is a key. */
  readonly by_reason: Readonly<Record<ResolutionFailureReason, number>>;
}

function empty_by_reason(): Record<ResolutionFailureReason, number> {
  const counts = {} as Record<ResolutionFailureReason, number>;
  for (const reason of RESOLUTION_FAILURE_REASONS) counts[reason] = 0;
  return counts;
}

/**
 * Count the taxonomy over exactly the calls the fingerprint reads: every
 * CallReference the resolution registry holds for every indexed file.
 */
export function count_failure_taxonomy(
  resolutions: CallSource,
  indexed_files: readonly FilePath[],
): FailureTaxonomy {
  const by_reason = empty_by_reason();
  let call_references = 0;
  let resolved = 0;
  for (const file of indexed_files) {
    for (const call of resolutions.get_calls_for_file(file)) {
      call_references++;
      if (call.resolutions.length > 0) {
        resolved++;
        continue;
      }
      const failure = call.resolution_failure;
      if (failure === undefined) {
        throw new Error(
          `The call to "${call.name}" at ${location_key(call.location)} carries neither a target nor a resolution failure. ` +
            "A taxonomy summed over it would be short of the call references it is stated over; the resolver exit that emitted it has to record a reason.",
        );
      }
      by_reason[failure.reason]++;
    }
  }
  return { call_references, resolved, by_reason };
}

export function unresolved_total(taxonomy: FailureTaxonomy): number {
  let total = 0;
  for (const reason of RESOLUTION_FAILURE_REASONS) {
    total += taxonomy.by_reason[reason];
  }
  return total;
}

interface LabelledTaxonomy {
  readonly label: string;
  readonly taxonomy: FailureTaxonomy;
}

/** Reasons sit under the `unresolved` figure they break down. */
const REASON_INDENT = "  ";

/**
 * One line per figure, the arms side by side, reasons ordered by the first
 * arm's count so the mass reads top-down. With two arms the delta is the last
 * column, because a step's recovery is candidate minus control on one row.
 */
export function format_failure_taxonomy_table(
  arms: readonly LabelledTaxonomy[],
): string[] {
  // Measured over the strings the table prints, indent included: a width taken
  // from the bare reason names lets the longest ones push their own numbers out
  // of column.
  const label_width = Math.max(
    "call_references".length,
    ...RESOLUTION_FAILURE_REASONS.map(
      (reason) => REASON_INDENT.length + reason.length,
    ),
  );
  const column_width = 12;
  const pad = (value: string | number) =>
    String(value).padStart(column_width);
  const header =
    "".padEnd(label_width) +
    arms.map((arm) => pad(arm.label)).join("") +
    (arms.length === 2 ? pad("delta") : "");
  const line = (name: string, values: readonly number[]) =>
    name.padEnd(label_width) +
    values.map(pad).join("") +
    (values.length === 2 ? pad(values[1] - values[0]) : "");
  const first = arms[0].taxonomy;
  const reasons = [...RESOLUTION_FAILURE_REASONS].sort(
    (left, right) => first.by_reason[right] - first.by_reason[left],
  );
  return [
    header,
    line(
      "call_references",
      arms.map((arm) => arm.taxonomy.call_references),
    ),
    line(
      "resolved",
      arms.map((arm) => arm.taxonomy.resolved),
    ),
    line(
      "unresolved",
      arms.map((arm) => unresolved_total(arm.taxonomy)),
    ),
    ...reasons.map((reason) =>
      line(
        `${REASON_INDENT}${reason}`,
        arms.map((arm) => arm.taxonomy.by_reason[reason]),
      ),
    ),
  ];
}
