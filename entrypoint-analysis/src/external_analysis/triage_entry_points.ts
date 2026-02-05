/**
 * Triage Entry Points for External Repositories
 *
 * Three-stage pipeline for classifying detected entry points as either
 * true positives (legitimate public API) or false positives (detection bugs):
 *
 * 1. **Deterministic pre-classification**: Apply rule-based classification
 *    using enriched metadata (exported status, access modifier, callback
 *    context, diagnostic data). Handles 60-80% of entries with no LLM cost.
 *
 * 2. **Parallel entry investigation**: For unclassified entries, run
 *    per-entry two-phase queries that determine whether each entry is a
 *    legitimate entry point or a false positive. Processes up to 5 entries
 *    concurrently.
 *
 * 3. **Aggregation**: A single aggregation call reviews false positive
 *    analyses and groups them by shared root cause.
 *
 * Unlike self-analysis triage (which assumes all entries are false positives
 * and diagnoses bugs), this script must decide whether each entry is a real
 * public API entry point or a detection artifact.
 *
 * Usage:
 *   npx tsx triage_entry_points.ts
 *   npx tsx triage_entry_points.ts --limit 10
 *
 * Options:
 *   --limit <n>  Max unclassified entries to send to LLM triage (default: all)
 */

import path from "path";
import type {
  AnalysisResult,
  EnrichedFunctionEntry,
  FalsePositiveEntry,
  FalsePositiveGroup,
} from "../types.js";
import {
  load_json,
  save_json,
  find_most_recent_external_analysis,
  AnalysisCategory,
  ExternalScriptType,
} from "../analysis_io.js";
import {
  two_phase_query,
  two_phase_query_detailed,
  parallel_map,
} from "../agent_queries.js";
import {
  classify_entrypoints,
  type ClassifiedEntry,
} from "../classify_entrypoints.js";

const TRIAGE_CONCURRENCY = 5;

// ===== Types =====

/** Triage results with true/false positive separation */
interface EntryPointTriageResults {
  true_positives: FalsePositiveEntry[];
  groups: Record<string, FalsePositiveGroup>;
  last_updated: string;
}

/** Per-entry response from triage two-phase query */
interface EntryTriageResponse {
  is_true_positive: boolean;
  group_id: string;
  root_cause: string;
  reasoning: string;
}

/** Per-entry analysis with investigation text for aggregation */
interface EntryAnalysis {
  entry: EnrichedFunctionEntry;
  response: EntryTriageResponse;
  investigation_text: string;
}

/** Aggregation response */
interface AggregationResponse {
  groups: {
    group_id: string;
    root_cause: string;
    reasoning: string;
    entry_names: string[];
  }[];
}

// ===== Filtering =====

/**
 * Check if entry is already in any group or true_positives list
 */
function is_already_processed(
  entry: EnrichedFunctionEntry,
  results: EntryPointTriageResults
): boolean {
  // Check true positives
  if (results.true_positives.some(
    (e) => e.name === entry.name && e.file_path === entry.file_path && e.start_line === entry.start_line
  )) {
    return true;
  }

  // Check groups
  for (const group of Object.values(results.groups)) {
    if (
      group.entries.some(
        (e) =>
          e.name === entry.name &&
          e.file_path === entry.file_path &&
          e.start_line === entry.start_line
      )
    ) {
      return true;
    }
  }
  return false;
}

// ===== Stage 1: Deterministic Pre-classification =====

/**
 * Populate triage results from deterministic classification.
 */
function apply_pre_classification(
  classified: ClassifiedEntry[],
  results: EntryPointTriageResults,
): number {
  let count = 0;

  for (const { entry, group_id, root_cause } of classified) {
    const entry_data: FalsePositiveEntry = {
      name: entry.name,
      file_path: entry.file_path,
      start_line: entry.start_line,
      signature: entry.signature,
    };

    const existing = results.groups[group_id];
    if (existing) {
      existing.entries.push(entry_data);
    } else {
      results.groups[group_id] = {
        group_id,
        root_cause,
        reasoning: "Deterministic classification based on enriched metadata",
        existing_task_fixes: [],
        entries: [entry_data],
      };
    }
    count++;
  }

  return count;
}

// ===== Stage 2: Parallel Entry Investigation =====

/**
 * Build investigation prompt for external repo entry point classification.
 */
function build_investigation_prompt(entry: EnrichedFunctionEntry): string {
  const grep_sites = entry.diagnostics.grep_call_sites.length > 0
    ? entry.diagnostics.grep_call_sites
        .map((h) => `  ${h.file_path}:${h.line}: ${h.content}`)
        .join("\n")
    : "  (none found)";

  const call_refs = entry.diagnostics.ariadne_call_refs.length > 0
    ? entry.diagnostics.ariadne_call_refs
        .map((r) =>
          `  Called from ${r.caller_function} at ${r.caller_file}:${r.call_line} (${r.call_type}), resolutions: [${r.resolved_to.join(", ") || "NONE"}]`
        )
        .join("\n")
    : "  (none found)";

  const callback_info = entry.callback_context
    ? `is_callback=${entry.callback_context.is_callback}, receiver_is_external=${entry.callback_context.receiver_is_external}`
    : "N/A";

  const call_summary = entry.call_summary;

  return `TASK: Determine whether this detected entry point is a legitimate public API
entry point or a false positive caused by a detection bug.

This is an external codebase with no ground truth. Decide based on evidence:
Is this function meant to be called by external consumers, or is it internal?

If legitimate entry point: set is_true_positive=true.
If false positive: set is_true_positive=false and diagnose the root cause.

CALLABLE METADATA:
- Name: ${entry.name}
- Kind: ${entry.kind}
- File: ${entry.file_path}:${entry.start_line}
- Exported: ${entry.is_exported}
- Access: ${entry.access_modifier || "N/A"}
- Static: ${entry.is_static ?? "N/A"}
- Signature: ${entry.signature || "N/A"}
- Callback context: ${callback_info}
- Call summary: total=${call_summary.total_calls}, unresolved=${call_summary.unresolved_count}, methods=${call_summary.method_calls}, constructors=${call_summary.constructor_calls}, callbacks=${call_summary.callback_invocations}

PRE-DIAGNOSIS: ${entry.diagnostics.diagnosis}

TEXTUAL CALL SITES (grep results for "${entry.name}("):
${grep_sites}

ARIADNE CALL REFERENCES (matching name in call graph registry):
${call_refs}

CLASSIFICATION GUIDELINES:

TRUE POSITIVE (is_true_positive=true) if:
  - The function is exported and has no internal callers (it's a public API)
  - The function is a module-level entry point (e.g., main, CLI handler)
  - The function is part of a public interface/protocol

FALSE POSITIVE (is_true_positive=false) if:
  - The function has real callers that the call graph missed
  - The function is internal but was not resolved due to a detection bug
  - The function is a callback, constructor, or private method that should have been linked

For false positives, identify the root cause of the detection failure.`;
}

const EXTRACTION_PROMPT = `Convert your analysis into this JSON format (no markdown):
{
  "is_true_positive": true/false,
  "group_id": "<kebab-case-short-id or 'true-positive'>",
  "root_cause": "<description of why this is a true/false positive>",
  "reasoning": "<explanation connecting the callable to the classification>"
}`;

/**
 * Analyze a single entry with two-phase query.
 */
async function analyze_entry(
  entry: EnrichedFunctionEntry,
  index: number,
  total: number,
): Promise<EntryAnalysis> {
  console.error(
    `\n🔍 [${index + 1}/${total}] Analyzing: ${entry.name} in ${path.basename(entry.file_path)}:${entry.start_line}`
  );

  const investigation_prompt = build_investigation_prompt(entry);

  const { result, investigation_text, total_cost } =
    await two_phase_query_detailed<EntryTriageResponse>(
      investigation_prompt,
      EXTRACTION_PROMPT,
      { model: "sonnet" },
    );

  const label = result.is_true_positive ? "✅ true positive" : `❌ false positive → "${result.group_id}"`;
  console.error(`   → ${label} (cost: $${total_cost.toFixed(4)})`);

  return {
    entry,
    response: result,
    investigation_text,
  };
}

// ===== Stage 3: Aggregation =====

/**
 * Review false positive analyses and group by root cause.
 */
async function aggregate_analyses(
  analyses: EntryAnalysis[],
): Promise<AggregationResponse> {
  console.error(`\n🧠 Running aggregation over ${analyses.length} false positive analyses...`);

  const entries_text = analyses
    .map((a) => {
      const e = a.entry;
      return `Entry: ${e.name} (${e.kind}) at ${e.file_path}:${e.start_line}
  Diagnosis: ${e.diagnostics.diagnosis}
  Triage group_id: ${a.response.group_id}
  Triage root_cause: ${a.response.root_cause}
  Investigation summary: ${a.investigation_text.slice(0, 500)}`;
    })
    .join("\n---\n");

  const investigation_prompt = `TASK: Review these individual false positive analyses and group them by root cause.

Each entry below was individually analyzed to determine why it was incorrectly
detected as an entry point. Your job is to:

1. Identify entries that share the same root cause (same detection failure)
2. Merge duplicate or overlapping group_ids into canonical group names
3. Write a precise root_cause description for each group
4. Explain the reasoning connecting all entries in each group

INDIVIDUAL ANALYSES:
${entries_text}

Review all entries carefully. Group entries that have the same underlying detection failure,
even if the individual analyses used different group_id names for the same root cause.`;

  const extraction_prompt = `Convert your analysis into this JSON (no markdown):
{
  "groups": [
    {
      "group_id": "<canonical-kebab-case-id>",
      "root_cause": "<precise description of the detection gap>",
      "reasoning": "<explanation connecting all entries in this group>",
      "entry_names": ["entry1", "entry2"]
    }
  ]
}

Include ALL entries in exactly one group each. Use the function names from the analyses.`;

  const result = await two_phase_query<AggregationResponse>(
    investigation_prompt,
    extraction_prompt,
    { model: "opus" },
  );

  console.error(`   ✓ Aggregated ${analyses.length} entries into ${result.groups.length} groups`);

  return result;
}

/**
 * Apply aggregation results to the triage output.
 */
function apply_aggregation_groups(
  aggregation_result: AggregationResponse,
  analyses: EntryAnalysis[],
  results: EntryPointTriageResults,
): void {
  // Build name→entry lookup
  const entry_by_name = new Map<string, EnrichedFunctionEntry>();
  for (const analysis of analyses) {
    entry_by_name.set(analysis.entry.name, analysis.entry);
  }

  for (const group of aggregation_result.groups) {
    const entries: FalsePositiveEntry[] = [];
    for (const name of group.entry_names) {
      const entry = entry_by_name.get(name);
      if (entry) {
        entries.push({
          name: entry.name,
          file_path: entry.file_path,
          start_line: entry.start_line,
          signature: entry.signature,
        });
      }
    }

    if (entries.length === 0) continue;

    const existing = results.groups[group.group_id];
    if (existing) {
      if (group.root_cause) existing.root_cause = group.root_cause;
      if (group.reasoning) existing.reasoning = group.reasoning;
      existing.entries.push(...entries);
    } else {
      results.groups[group.group_id] = {
        group_id: group.group_id,
        root_cause: group.root_cause,
        reasoning: group.reasoning,
        existing_task_fixes: [],
        entries,
      };
    }
  }
}

// ===== Summary =====

function print_summary(
  results: EntryPointTriageResults,
  stats: {
    total_entry_points: number;
    already_processed: number;
    pre_classified_true_positives: number;
    pre_classified_false_positives: number;
    llm_true_positives: number;
    llm_false_positives: number;
    analysis_errors: number;
  },
  output_file: string,
): void {
  console.error("\n" + "=".repeat(60));
  console.error("ENTRY POINT TRIAGE SUMMARY");
  console.error("=".repeat(60));
  console.error(`Total entry points: ${stats.total_entry_points}`);
  console.error(`  Already processed: ${stats.already_processed}`);
  console.error(`  Pre-classified true positives: ${stats.pre_classified_true_positives}`);
  console.error(`  Pre-classified false positives: ${stats.pre_classified_false_positives}`);
  console.error(`  LLM-classified true positives: ${stats.llm_true_positives}`);
  console.error(`  LLM-classified false positives: ${stats.llm_false_positives}`);
  console.error(`  Analysis errors: ${stats.analysis_errors}`);
  console.error(`Total true positives: ${results.true_positives.length}`);
  console.error(`Total false positive groups: ${Object.keys(results.groups).length}`);
  console.error(`\nResults saved to: ${output_file}`);

  // Show group breakdown
  const sorted_groups = Object.values(results.groups).sort(
    (a, b) => b.entries.length - a.entries.length
  );
  if (sorted_groups.length > 0) {
    console.error("\nFalse positive groups by size:");
    for (const group of sorted_groups) {
      console.error(`  - ${group.group_id}: ${group.entries.length} entries`);
    }
  }
}

// ===== Main =====

function parse_limit_arg(): number | undefined {
  const args = process.argv.slice(2);
  const limit_arg = args.find((a) => a.startsWith("--limit="));
  if (limit_arg) {
    return parseInt(limit_arg.split("=")[1], 10);
  }
  const limit_index = args.indexOf("--limit");
  if (limit_index !== -1 && args[limit_index + 1]) {
    return parseInt(args[limit_index + 1], 10);
  }
  return undefined;
}

async function main() {
  const limit = parse_limit_arg();
  if (limit !== undefined) {
    console.error(`Limit: processing at most ${limit} entries for LLM triage`);
  }

  console.error("Finding most recent analysis file...");
  const analysis_file = await find_most_recent_external_analysis();
  console.error(`Using analysis file: ${analysis_file}`);

  // Load analysis data
  const analysis: AnalysisResult = await load_json(analysis_file);

  // Initialize results
  const results: EntryPointTriageResults = {
    true_positives: [],
    groups: {},
    last_updated: new Date().toISOString(),
  };

  // No hard-coded file filter — all entries go through triage
  const to_triage = analysis.entry_points;

  // Filter out already processed entries
  const to_process = to_triage.filter(
    (ep) => !is_already_processed(ep, results)
  );
  const already_processed = to_triage.length - to_process.length;

  console.error(`\n📊 Total entry points: ${analysis.entry_points.length}`);
  console.error(`   Already processed: ${already_processed}`);
  console.error(`   To process: ${to_process.length}`);

  // Stage 1: Deterministic pre-classification
  console.error("\n🏷️  Stage 1: Deterministic pre-classification...");
  const classification = classify_entrypoints(to_process);

  // Rule 1 true positives go to true_positives list
  for (const entry of classification.true_positives) {
    results.true_positives.push({
      name: entry.name,
      file_path: entry.file_path,
      start_line: entry.start_line,
      signature: entry.signature,
    });
  }

  console.error(`   True positives: ${classification.true_positives.length}`);
  console.error(`   Classified false positives: ${classification.classified_false_positives.length}`);
  console.error(`   Unclassified (need LLM): ${classification.unclassified.length}`);

  const pre_classified_count = apply_pre_classification(
    classification.classified_false_positives,
    results,
  );

  // Stage 2: Parallel entry investigation of unclassified entries
  const all_unclassified = classification.unclassified;
  const unclassified = limit !== undefined ? all_unclassified.slice(0, limit) : all_unclassified;
  if (limit !== undefined && all_unclassified.length > limit) {
    console.error(`   Limiting LLM triage to ${limit} of ${all_unclassified.length} unclassified entries`);
  }

  let analysis_error_count = 0;
  const entry_analyses: EntryAnalysis[] = [];
  let llm_true_positive_count = 0;

  if (unclassified.length > 0) {
    console.error(`\n🤖 Stage 2: Triage analysis of ${unclassified.length} entries (${TRIAGE_CONCURRENCY} workers)...`);

    try {
      const raw_results = await parallel_map(
        unclassified,
        async (entry, index) => {
          try {
            return await analyze_entry(entry, index, unclassified.length);
          } catch (error) {
            console.error(`   ⚠️  Error analyzing ${entry.name}: ${error}`);
            analysis_error_count++;
            return null;
          }
        },
        TRIAGE_CONCURRENCY,
      );

      // Partition into true/false positives
      for (const result of raw_results) {
        if (!result) continue;

        if (result.response.is_true_positive) {
          results.true_positives.push({
            name: result.entry.name,
            file_path: result.entry.file_path,
            start_line: result.entry.start_line,
            signature: result.entry.signature,
          });
          llm_true_positive_count++;
        } else {
          entry_analyses.push(result);
        }
      }
    } catch (error) {
      console.error(`\n⚠️  Stage 2 error: ${error}`);
    }
  }

  // Stage 3: Aggregation (only for false positives)
  if (entry_analyses.length > 0) {
    console.error(`\n🧠 Stage 3: Aggregation of ${entry_analyses.length} false positive analyses...`);

    try {
      const aggregation_result = await aggregate_analyses(entry_analyses);
      apply_aggregation_groups(aggregation_result, entry_analyses, results);
    } catch (error) {
      console.error(`\n⚠️  Aggregation failed: ${error}`);
      console.error("   Falling back to per-entry triage groups...");

      for (const analysis of entry_analyses) {
        const entry_data: FalsePositiveEntry = {
          name: analysis.entry.name,
          file_path: analysis.entry.file_path,
          start_line: analysis.entry.start_line,
          signature: analysis.entry.signature,
        };

        const group_id = analysis.response.group_id;
        const existing = results.groups[group_id];
        if (existing) {
          existing.entries.push(entry_data);
        } else {
          results.groups[group_id] = {
            group_id,
            root_cause: analysis.response.root_cause,
            reasoning: analysis.response.reasoning,
            existing_task_fixes: [],
            entries: [entry_data],
          };
        }
      }
    }
  }

  // Save results
  results.last_updated = new Date().toISOString();
  const output_file = await save_json(
    AnalysisCategory.EXTERNAL,
    ExternalScriptType.TRIAGE_ENTRY_POINTS,
    results
  );

  print_summary(results, {
    total_entry_points: analysis.entry_points.length,
    already_processed: already_processed,
    pre_classified_true_positives: classification.true_positives.length,
    pre_classified_false_positives: pre_classified_count,
    llm_true_positives: llm_true_positive_count,
    llm_false_positives: entry_analyses.length,
    analysis_errors: analysis_error_count,
  }, output_file);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
