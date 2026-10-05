/**
 * Structural + business-rule validator for a `refactor-consolidator`'s
 * `consolidation.json` (prioritize step 4's output). `consolidation.json` is the
 * spine of steps 5–7 yet is never parsed by code — its ids reach export only via
 * human copy-paste into `--id` flags, so a row dropped from every cluster
 * silently never exports and a double-assigned row exports twice. This validator
 * closes that gap: prioritize runs it as step 4.5 and re-runs it as an export
 * precondition.
 *
 * Pure: it takes the parsed JSON plus context and returns `{ ok, issues }`,
 * mirroring `validate_plan`. On success the input conforms to
 * {@link Consolidation}.
 */

/** The slug shape a comprehension doc filename embeds: lowercase alnum, `-`/`_` interior. */
const SLUG_REGEX = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

export type ConsolidationIssueCode =
  | "shape_error"
  | "row_dropped"
  | "row_double_assigned"
  | "row_unknown"
  | "plan_path_missing"
  | "bad_slug"
  | "duplicate_slug"
  | "permanent_rerouted_in_cluster";

export interface ConsolidationIssue {
  code: ConsolidationIssueCode;
  /** A dotted path to the offending node/field, e.g. `clusters[1].member_row_ids`. */
  path: string;
  message: string;
}

export interface ValidateConsolidationContext {
  /** The union of every investigated group's `row_ids` — the exact set the clusters must partition. */
  investigated_row_ids: readonly string[];
  /** Row ids a verdict rerouted INTO the permanent-limitation set; must appear in no cluster. */
  permanent_rerouted_ids: readonly string[];
  /** Injected disk check for `plan_path` existence (the CLI passes `fs.existsSync`). */
  plan_path_exists: (plan_path: string) => boolean;
}

export interface ValidateConsolidationResult {
  ok: boolean;
  issues: ConsolidationIssue[];
}

interface ConsolidationCluster {
  slug: string;
  member_row_ids: string[];
  plan_path: string;
}

export interface Consolidation {
  clusters: ConsolidationCluster[];
}

function is_string_array(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

/** Narrow one raw cluster; returns the typed cluster or a shape issue for `clusters[i]`. */
function narrow_cluster(
  raw: unknown,
  path: string,
): { cluster: ConsolidationCluster } | { issue: ConsolidationIssue } {
  if (typeof raw !== "object" || raw === null) {
    return { issue: { code: "shape_error", path, message: "cluster must be an object" } };
  }
  const record = raw as Record<string, unknown>;
  if (typeof record["slug"] !== "string" || record["slug"].length === 0) {
    return { issue: { code: "shape_error", path: `${path}.slug`, message: "slug must be a non-empty string" } };
  }
  if (!is_string_array(record["member_row_ids"]) || record["member_row_ids"].length === 0) {
    return {
      issue: {
        code: "shape_error",
        path: `${path}.member_row_ids`,
        message: "member_row_ids must be a non-empty array of strings",
      },
    };
  }
  if (typeof record["plan_path"] !== "string" || record["plan_path"].length === 0) {
    return {
      issue: { code: "shape_error", path: `${path}.plan_path`, message: "plan_path must be a non-empty string" },
    };
  }
  return {
    cluster: {
      slug: record["slug"],
      member_row_ids: record["member_row_ids"],
      plan_path: record["plan_path"],
    },
  };
}

export function validate_consolidation(
  raw: unknown,
  ctx: ValidateConsolidationContext,
): ValidateConsolidationResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, issues: [{ code: "shape_error", path: "$", message: "consolidation must be an object" }] };
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record["clusters"])) {
    return { ok: false, issues: [{ code: "shape_error", path: "clusters", message: "clusters must be an array" }] };
  }

  const issues: ConsolidationIssue[] = [];
  const clusters: ConsolidationCluster[] = [];
  record["clusters"].forEach((raw_cluster, i) => {
    const narrowed = narrow_cluster(raw_cluster, `clusters[${i}]`);
    if ("issue" in narrowed) issues.push(narrowed.issue);
    else clusters.push(narrowed.cluster);
  });
  // A malformed cluster leaves the partition/slug checks below unable to trust
  // the whole set, so stop at the shape errors rather than emit noise.
  if (issues.length > 0) return { ok: false, issues };

  // Slug shape + uniqueness. A slug typo silently loses the comprehension doc at
  // graduation (`graduate_group_docs.ts` moves exactly `<slug>.comprehension.html`).
  const seen_slugs = new Map<string, number>();
  clusters.forEach((cluster, i) => {
    if (!SLUG_REGEX.test(cluster.slug)) {
      issues.push({
        code: "bad_slug",
        path: `clusters[${i}].slug`,
        message: `slug "${cluster.slug}" is not filename-safe (expected ${SLUG_REGEX.source})`,
      });
    }
    const first = seen_slugs.get(cluster.slug);
    if (first === undefined) seen_slugs.set(cluster.slug, i);
    else {
      issues.push({
        code: "duplicate_slug",
        path: `clusters[${i}].slug`,
        message: `slug "${cluster.slug}" duplicates clusters[${first}].slug`,
      });
    }
  });

  // plan_path exists on disk — a dangling path renders no comprehension doc.
  clusters.forEach((cluster, i) => {
    if (!ctx.plan_path_exists(cluster.plan_path)) {
      issues.push({
        code: "plan_path_missing",
        path: `clusters[${i}].plan_path`,
        message: `plan_path "${cluster.plan_path}" does not exist on disk`,
      });
    }
  });

  // Exact partition of member_row_ids over the investigated row ids. A row
  // rerouted to a permanent limitation is legitimately absent from every cluster
  // (it routes to classifier-author), so it is exempt from the drop check — the
  // permanent_rerouted_in_cluster check below still catches one that leaks in.
  const investigated = new Set(ctx.investigated_row_ids);
  const permanent = new Set(ctx.permanent_rerouted_ids);
  const assignment_count = new Map<string, number[]>();
  clusters.forEach((cluster, i) => {
    for (const id of cluster.member_row_ids) {
      const clusters_for_id = assignment_count.get(id) ?? [];
      clusters_for_id.push(i);
      assignment_count.set(id, clusters_for_id);
    }
  });

  for (const id of investigated) {
    if (!assignment_count.has(id) && !permanent.has(id)) {
      issues.push({
        code: "row_dropped",
        path: "clusters",
        message: `investigated row "${id}" appears in no cluster — it would silently never export`,
      });
    }
  }
  for (const [id, cluster_indices] of assignment_count) {
    if (cluster_indices.length > 1) {
      issues.push({
        code: "row_double_assigned",
        path: `clusters[${cluster_indices.join("],clusters[")}].member_row_ids`,
        message: `row "${id}" appears in ${cluster_indices.length} clusters (${cluster_indices.join(", ")}) — it would export twice`,
      });
    }
    if (!investigated.has(id)) {
      issues.push({
        code: "row_unknown",
        path: `clusters[${cluster_indices[0]}].member_row_ids`,
        message: `row "${id}" is not in the investigated row-id set`,
      });
    }
  }

  // A row rerouted to a permanent limitation routes to classifier-author, never
  // into a cluster, so any such id in a cluster is a routing error.
  clusters.forEach((cluster, i) => {
    for (const id of cluster.member_row_ids) {
      if (permanent.has(id)) {
        issues.push({
          code: "permanent_rerouted_in_cluster",
          path: `clusters[${i}].member_row_ids`,
          message: `row "${id}" was rerouted to a permanent limitation — it routes to classifier-author, not a cluster`,
        });
      }
    }
  });

  return { ok: issues.length === 0, issues };
}
