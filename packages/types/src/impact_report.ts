/**
 * Wire types for the impact report the plan skill emits for human review.
 * Plan produces `impact_report.json` at the end of a sweep, ranking registry
 * entries by observed_count; it is not consumed by any downstream script.
 *
 * Identity field is `group_id` (registry-side identity), not `novel_issue_id`
 * (dispatch-side identity). The two are deliberately distinct: `group_id` keys
 * the registry row, `novel_issue_id` keys a single dispatch.
 */

/**
 * Row rendered in the top-N table and the JSON wire envelope. Holds the raw
 * numeric fields so the markdown renderer and the JSON wire envelope share
 * one shape.
 */
export interface ImpactRow {
  group_id: string;
  title: string;
  status: string;
  observed_count: number;
  observed_projects: string[];
  languages: string[];
  backlog_task: string | null;
  delta_since_prior: number;
}

/** Current schema version for the on-disk impact report file. */
export const IMPACT_REPORT_SCHEMA_VERSION = 1 as const;
export type ImpactReportSchemaVersion = typeof IMPACT_REPORT_SCHEMA_VERSION;

/**
 * Wire format for `impact_report.json` on disk. Carrying `schema_version`
 * separately from the row array lets future field changes be detected by
 * loaders without forcing downstream consumers to thread the version through.
 */
export interface ImpactReportFile {
  schema_version: ImpactReportSchemaVersion;
  rows: ImpactRow[];
}
