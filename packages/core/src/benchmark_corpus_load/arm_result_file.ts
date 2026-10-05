/**
 * How an arm's result survives the process that produced it.
 *
 * Arms are interleaved across separate processes, so the diff between two of
 * them happens somewhere neither of them is running. The row alone is not
 * enough: a comparison that can only say "the call-edge hash changed" is a
 * regression alarm without a regression report, so the fingerprint's members
 * travel too.
 *
 * The file is line-oriented and both written and read a line at a time. A
 * full-corpus arm holds over two million members, and a single
 * `JSON.stringify` of that array is the same V8 maximum-string-length failure
 * that once lost a whole run inside `Array.prototype.join`.
 *
 * The row line is written LAST. A file that has a row line is a file whose
 * members were all flushed before it, so the row's presence is the
 * completeness proof and no separate terminator is needed — where a row-first
 * format would read back as valid whenever the truncated tail happened to be
 * an empty component. The failure taxonomy travels on its own line just
 * before the row: it is a fourteen-key summary rather than members, and a
 * file without it is an arm that did not finish.
 *
 * Each member is JSON-encoded on its line. A symbol id ends in a name taken
 * from source text, and a quoted property name may legally contain a tab or a
 * newline; unencoded, one such member would corrupt the line format and be
 * read back as two.
 *
 * Reading recomputes each component's digest from its members and checks it
 * against the digest the row recorded. That catches a truncated file, and it
 * also means a change to the hash functions cannot quietly revalue an already
 * recorded baseline.
 */

import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createInterface } from "readline";
import { digest_members } from "./streaming_digest";
import {
  FINGERPRINT_COMPONENT_NAMES,
  type CallGraphFingerprint,
  type FingerprintComponent,
  type FingerprintComponentName,
} from "./call_graph_fingerprint";
import type { MeasurementRow } from "./measurement_row";
import type { ArmResult } from "./benchmark_corpus_load";
import {
  RESOLUTION_FAILURE_REASONS,
  unresolved_total,
  type FailureTaxonomy,
} from "./failure_taxonomy";

const ROW_LINE_PREFIX = "row\t";
const TAXONOMY_LINE_PREFIX = "failure_taxonomy\t";

/**
 * Yield the file a line at a time so backpressure, write errors and stream
 * teardown are the pipeline's problem. A hand-rolled `write`/`drain` loop
 * hangs forever when the stream errors instead — `drain` never fires — and a
 * silent hang at the persist step, after the load has already been paid for,
 * is the worst version of the hours-then-nothing failure this harness exists to
 * end.
 */
function* arm_result_lines(result: ArmResult): Generator<string> {
  for (const component of FINGERPRINT_COMPONENT_NAMES) {
    for (const member of result.fingerprint[component].members) {
      yield `${component}\t${JSON.stringify(member)}\n`;
    }
  }
  yield `${TAXONOMY_LINE_PREFIX}${JSON.stringify(result.failure_taxonomy)}\n`;
  yield `${ROW_LINE_PREFIX}${JSON.stringify(result.row)}\n`;
}

export async function write_arm_result(
  file_path: string,
  result: ArmResult,
): Promise<void> {
  await pipeline(
    arm_result_lines(result),
    createWriteStream(file_path, { encoding: "utf-8" }),
  );
}

export async function read_arm_result(file_path: string): Promise<ArmResult> {
  const lines = createInterface({
    input: createReadStream(file_path, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  const members = new Map<FingerprintComponentName, string[]>();
  for (const component of FINGERPRINT_COMPONENT_NAMES) {
    members.set(component, []);
  }

  let row: MeasurementRow | undefined;
  let failure_taxonomy: FailureTaxonomy | undefined;

  for await (const line of lines) {
    if (line === "") continue;
    if (line.startsWith(ROW_LINE_PREFIX)) {
      row = JSON.parse(line.slice(ROW_LINE_PREFIX.length)) as MeasurementRow;
      continue;
    }
    if (line.startsWith(TAXONOMY_LINE_PREFIX)) {
      failure_taxonomy = JSON.parse(
        line.slice(TAXONOMY_LINE_PREFIX.length),
      ) as FailureTaxonomy;
      continue;
    }
    const separator = line.indexOf("\t");
    if (separator === -1) {
      throw new Error(
        `${file_path} holds a line with no component separator: ${line.slice(0, 80)}`,
      );
    }
    const component = line.slice(0, separator) as FingerprintComponentName;
    const held = members.get(component);
    if (held === undefined) {
      throw new Error(
        `${file_path} names an unknown fingerprint component "${component}"`,
      );
    }
    held.push(JSON.parse(line.slice(separator + 1)) as string);
  }

  if (row === undefined) {
    throw new Error(
      `${file_path} holds no measurement row — the row is written last, so its absence means the arm did not finish writing.`,
    );
  }
  if (failure_taxonomy === undefined) {
    throw new Error(
      `${file_path} holds a measurement row but no failure taxonomy — every finished arm writes one before its row.`,
    );
  }

  const fingerprint: Partial<
    Record<FingerprintComponentName, FingerprintComponent>
  > = {};
  for (const component of FINGERPRINT_COMPONENT_NAMES) {
    const component_members = members.get(component) ?? [];
    const hash = digest_members(component_members);
    const recorded = row.fingerprint.components[component];
    // The digest covers the count: a member list of a different length cannot
    // reproduce the recorded hash, so checking the length as well would only
    // ever fire alongside it.
    if (hash !== recorded.hash) {
      throw new Error(
        `${file_path} does not reproduce its own "${component}" component: recorded ${recorded.count}/${recorded.hash}, read back ${component_members.length}/${hash}`,
      );
    }
    fingerprint[component] = {
      count: component_members.length,
      hash,
      members: component_members,
    };
  }

  assert_taxonomy_reproduces_the_row(file_path, failure_taxonomy, row);

  return {
    row,
    fingerprint: fingerprint as CallGraphFingerprint,
    failure_taxonomy,
  };
}

/**
 * Hold the taxonomy to the row it travelled with, the way each component is
 * held to its recorded digest.
 *
 * A taxonomy is read back long after the arm's process is gone, and every use
 * of it — the side-by-side report, a recorded baseline row — states it over the
 * arm's call references. A file whose taxonomy does not close, or does not
 * agree with the unresolved count the same arm fingerprinted, describes two
 * different loads, and nothing downstream can tell which one is the arm.
 */
function assert_taxonomy_reproduces_the_row(
  file_path: string,
  taxonomy: FailureTaxonomy,
  row: MeasurementRow,
): void {
  const absent = RESOLUTION_FAILURE_REASONS.filter(
    (reason) => typeof taxonomy.by_reason[reason] !== "number",
  );
  if (absent.length > 0) {
    throw new Error(
      `${file_path} holds a failure taxonomy with no count for ${absent.join(", ")} — every reason is a key, so an arm and a recorded row always carry the same columns.`,
    );
  }

  const unresolved = unresolved_total(taxonomy);
  if (taxonomy.resolved + unresolved !== taxonomy.call_references) {
    throw new Error(
      `${file_path} holds a failure taxonomy that does not close: ${taxonomy.resolved} resolved plus ${unresolved} failed is not the ${taxonomy.call_references} call references it is stated over.`,
    );
  }

  const fingerprinted = row.fingerprint.components.unresolved_calls.count;
  if (unresolved !== fingerprinted) {
    throw new Error(
      `${file_path} holds a failure taxonomy counting ${unresolved} unresolved calls against a row fingerprinting ${fingerprinted} — the two are read from one registry over one file set, so they cannot disagree about the same arm.`,
    );
  }
}
