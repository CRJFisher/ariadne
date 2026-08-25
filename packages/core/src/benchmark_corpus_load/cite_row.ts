/**
 * The line a number is quoted with.
 *
 * A corpus-derived figure without its corpus commit, discovery predicate, file
 * count, Ariadne commit, machine and node version is not a measurement: at one
 * vscode commit there are four defensible file counts, and two of them answer
 * the same question in opposite directions. Rendering the obligation is what
 * discharges it — an obligation nothing prints is one nobody meets.
 */

import type { MeasurementRow } from "./measurement_row";

export interface RowCitation {
  readonly corpus_name: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly offered_file_count: number;
  readonly discovered_file_count: number;
  readonly ariadne_commit: string;
  readonly machine: string;
  readonly node_version: string;
}

export function cite_row(row: MeasurementRow): RowCitation {
  return {
    corpus_name: row.corpus.corpus_name,
    corpus_commit: row.corpus.corpus_commit,
    predicate: row.corpus.predicate,
    offered_file_count: row.file_counts.offered,
    discovered_file_count: row.file_counts.discovered,
    ariadne_commit: row.environment.ariadne_commit,
    machine: row.environment.machine,
    node_version: row.environment.node_version,
  };
}

/**
 * The one line a report pastes above a number. A sliced arm renders "200 of
 * 479 files" so a prefix is never mistaken for the whole corpus.
 */
export function format_citation(citation: RowCitation): string {
  const files =
    citation.offered_file_count === citation.discovered_file_count
      ? `${citation.discovered_file_count} files`
      : `${citation.offered_file_count} of ${citation.discovered_file_count} files`;
  return [
    `${citation.corpus_name}@${citation.corpus_commit}`,
    citation.predicate,
    files,
    `ariadne@${citation.ariadne_commit}`,
    citation.machine,
    `node ${citation.node_version}`,
  ].join(" · ");
}
