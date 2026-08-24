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
 * an empty component.
 *
 * Each member is JSON-encoded on its line. A symbol id ends in a name taken
 * from source text, and a quoted property name may legally contain a tab or a
 * newline; unencoded, one such member would both corrupt the line format and
 * silently collide with another member in the digest.
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

const ROW_LINE_PREFIX = "row\t";

/**
 * Yield the file a line at a time so backpressure, write errors and stream
 * teardown are the pipeline's problem. A hand-rolled `write`/`drain` loop
 * hangs forever when the stream errors instead — `drain` never fires — and a
 * silent hang at the persist step, after the load has already been paid for,
 * is the worst version of the failure this epic exists to end.
 */
function* arm_result_lines(result: ArmResult): Generator<string> {
  for (const component of FINGERPRINT_COMPONENT_NAMES) {
    for (const member of result.fingerprint[component].members) {
      yield `${component}\t${JSON.stringify(member)}\n`;
    }
  }
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

  for await (const line of lines) {
    if (line === "") continue;
    if (line.startsWith(ROW_LINE_PREFIX)) {
      row = JSON.parse(line.slice(ROW_LINE_PREFIX.length)) as MeasurementRow;
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

  const fingerprint: Partial<
    Record<FingerprintComponentName, FingerprintComponent>
  > = {};
  for (const component of FINGERPRINT_COMPONENT_NAMES) {
    const component_members = members.get(component) ?? [];
    const hash = digest_members(component_members);
    const recorded = row.fingerprint.components[component];
    if (hash !== recorded.hash || component_members.length !== recorded.count) {
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

  return { row, fingerprint: fingerprint as CallGraphFingerprint };
}
