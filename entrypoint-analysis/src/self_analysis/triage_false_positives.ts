/**
 * Triage False Positive Entry Points
 *
 * Three-stage pipeline for classifying false positive entry points:
 *
 * 1. **Deterministic pre-classification**: Apply rule-based classification
 *    using enriched metadata (exported status, access modifier, callback
 *    context, diagnostic data). Handles 60-80% of entries with no LLM cost.
 *
 * 2. **Parallel entry investigation**: For unclassified entries, run
 *    per-entry two-phase queries with pre-loaded diagnostic data and a
 *    structured debugging prompt. Processes up to 5 entries concurrently.
 *
 * 3. **Aggregation**: A single aggregation call reviews all individual
 *    entry analyses and groups entries by shared root cause, providing
 *    high-level pattern recognition.
 *
 * Filters out functions already deleted by detect_dead_code.ts before triaging.
 *
 * Results are held in memory and written once at the end (or on error)
 * to preserve data integrity.
 *
 * Usage:
 *   npx tsx triage_false_positives.ts --package core
 *   npx tsx triage_false_positives.ts --package core --limit 10
 *
 * Options:
 *   --package <name>  Required. Package to analyze (loads ground truth for true positive filtering)
 *   --limit <n>       Max unclassified entries to send to LLM triage (default: all)
 */

import path from "path";
import { fileURLToPath } from "url";
import * as fs from "node:fs/promises";
import type {
  AnalysisResult,
  EnrichedFunctionEntry,
  FalsePositiveTriageResults,
  FalsePositiveEntry,
  DeadCodeAnalysisResult,
} from "../types.js";
import {
  load_json,
  save_json,
  find_most_recent_analysis,
  find_most_recent_dead_code_analysis,
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

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

function get_timestamped_results_file(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, "-")
    .replace("T", "_");
  return path.resolve(__dirname, "../..", "analysis_output", `false_positive_triage_${timestamp}.json`);
}

const RESULTS_FILE = get_timestamped_results_file();
const TRIAGE_CONCURRENCY = 5;

// ===== Types =====

/** Per-entry response from triage two-phase query */
interface EntryTriageResponse {
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
 * Check if entry is already in any group
 */
function is_already_processed(
  entry: EnrichedFunctionEntry,
  results: FalsePositiveTriageResults
): boolean {
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

/**
 * Check if entry was deleted by dead code analysis
 */
function is_deleted(
  entry: EnrichedFunctionEntry,
  dead_code: DeadCodeAnalysisResult
): boolean {
  return dead_code.deletions.some(
    (d) =>
      d.name === entry.name &&
      d.file_path === entry.file_path &&
      d.start_line === entry.start_line
  );
}

// ===== Stage 1: Deterministic Pre-classification =====

/**
 * Populate triage results from deterministic classification.
 */
function apply_pre_classification(
  classified: ClassifiedEntry[],
  results: FalsePositiveTriageResults,
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
 * Build investigation prompt with pre-loaded diagnostic data.
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

  return `TASK: Diagnose why this callable was wrongly detected as an entry point
by Ariadne's call graph analyzer.

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

DEBUGGING STEPS (follow in order, stop when you find the root cause):

Step 1 — Verify callers exist:
  - Review the grep results above. Are any of these real calls to this function?
  - If unclear, run additional targeted searches:
    - For methods: grep for ".${entry.name}(" to catch any receiver pattern
    - For constructors: grep for constructor invocation patterns in the source language
    - For functions: grep for "${entry.name}(" excluding the definition file/line
  - Read the calling file(s) to confirm these are actual invocations, not just name matches

Step 2 — Check if Ariadne sees the calls:
  - Compare the grep call sites to the "ARIADNE CALL REFERENCES" section above
  - If Ariadne has NO matching CallReferences for a real caller
    → the bug is in reference detection (indexing/parsing missed the call)
  - If Ariadne HAS CallReferences but resolutions are empty
    → the bug is in reference resolution (couldn't match call to definition)
  - If CallReferences resolve to a DIFFERENT symbol
    → the bug is in scope resolution / symbol matching

Step 3 — Isolate the root cause using Ariadne's APIs:
  - Read the source code at the call site AND the definition to understand the exact pattern
  - Write and run a debug script in /tmp (npx tsx /tmp/debug_${entry.name}.ts) that uses:

    Ariadne Project API (import from packages/core/src/index.js):
      const project = new Project();
      await project.initialize(root_path, excluded_folders);
      project.update_file(file_path, source_code);

    Semantic Index — check what definitions/references were extracted:
      const index = project.get_index_single_file(file_path);
      // index.definitions — all definitions in the file
      // index.references — all references in the file
      // index.scopes — scope tree

    Call Graph — check call edges:
      const call_graph = project.get_call_graph();
      const node = call_graph.nodes.get(symbol_id);
      // node.enclosed_calls — calls this function makes
      // Iterate all nodes to find who calls this function

    Resolution Registry — check resolution details:
      project.resolutions.get_calls_by_caller_scope(scope_id)
      // Returns CallReference[] with resolutions for each call
      project.resolutions.get_all_referenced_symbols()
      // Returns Set<SymbolId> of all symbols that have callers

    Definition Lookup:
      project.get_definition(symbol_id)
      // Returns the full AnyDefinition for a symbol

  - Identify the specific code pattern that Ariadne fails to handle
    (e.g., "this.method() dispatch across class hierarchy",
     "callback passed to external function", "dynamic dispatch via collection", etc.)

Provide a clear, specific explanation of the root cause.`;
}

const EXTRACTION_PROMPT = `Convert your analysis into this JSON format (no markdown):
{
  "group_id": "<kebab-case-short-id>",
  "root_cause": "<description of why Ariadne misdetects this>",
  "reasoning": "<explanation connecting the callable to the root cause>"
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
      { model: "haiku" },
    );

  console.error(`   → group: "${result.group_id}" (cost: $${total_cost.toFixed(4)})`);

  return {
    entry,
    response: result,
    investigation_text,
  };
}

// ===== Stage 3: Aggregation =====

/**
 * Review all entry analyses and group by root cause.
 */
async function aggregate_analyses(
  analyses: EntryAnalysis[],
): Promise<AggregationResponse> {
  console.error(`\n🧠 Running aggregation over ${analyses.length} analyses...`);

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

Each entry below was individually analyzed by a fast model to determine why Ariadne's
call graph incorrectly classified it as an entry point (uncalled function). Your job is to:

1. Identify entries that share the same root cause (same bug in Ariadne's pipeline)
2. Merge duplicate or overlapping group_ids into canonical group names
3. Write a precise root_cause description for each group
4. Explain the reasoning connecting all entries in each group
5. Note any cross-group patterns

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
  results: FalsePositiveTriageResults,
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
      // Merge into existing group
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
  results: FalsePositiveTriageResults,
  stats: {
    total_entry_points: number;
    false_positives: number;
    deleted: number;
    already_processed: number;
    pre_classified: number;
    true_positives: number;
    entries_analyzed: number;
    analysis_errors: number;
  },
): void {
  console.error("\n" + "=".repeat(60));
  console.error("FALSE POSITIVE TRIAGE SUMMARY");
  console.error("=".repeat(60));
  console.error(`Total entry points: ${stats.total_entry_points}`);
  console.error(`False positives to triage: ${stats.false_positives}`);
  console.error(`  Already deleted: ${stats.deleted}`);
  console.error(`  Already grouped: ${stats.already_processed}`);
  console.error(`  Pre-classified (deterministic): ${stats.pre_classified}`);
  console.error(`  True positives (confirmed): ${stats.true_positives}`);
  console.error(`  Entries analyzed: ${stats.entries_analyzed}`);
  console.error(`  Analysis errors: ${stats.analysis_errors}`);
  console.error(`Total groups: ${Object.keys(results.groups).length}`);
  console.error(`\nResults saved to: ${RESULTS_FILE}`);

  // Show group breakdown
  console.error("\nGroups by size:");
  const sorted_groups = Object.values(results.groups).sort(
    (a, b) => b.entries.length - a.entries.length
  );
  for (const group of sorted_groups) {
    console.error(`  - ${group.group_id}: ${group.entries.length} entries`);
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

function parse_package_arg(): string | undefined {
  const args = process.argv.slice(2);
  const package_arg = args.find((a) => a.startsWith("--package="));
  if (package_arg) {
    return package_arg.split("=")[1];
  }
  const package_index = args.indexOf("--package");
  if (package_index !== -1 && args[package_index + 1]) {
    return args[package_index + 1];
  }
  return undefined;
}

interface GroundTruthEntry {
  name: string;
  file: string;
}

/**
 * Load ground truth file for a package.
 * Returns entries representing known true entry points (public API).
 */
async function load_ground_truth(package_name: string): Promise<GroundTruthEntry[]> {
  const ground_truth_path = path.resolve(
    __dirname, "../..",
    "ground_truth",
    `${package_name}.json`
  );
  try {
    const content = await fs.readFile(ground_truth_path, "utf-8");
    return JSON.parse(content) as GroundTruthEntry[];
  } catch {
    console.error(`Warning: No ground truth file found at ${ground_truth_path}`);
    return [];
  }
}

/**
 * Check if an entry matches a ground truth record (known true entry point).
 */
function matches_ground_truth(
  entry: EnrichedFunctionEntry,
  ground_truth: GroundTruthEntry[]
): boolean {
  return ground_truth.some(
    (gt) => entry.name === gt.name && entry.file_path.endsWith(gt.file)
  );
}

async function main() {
  const limit = parse_limit_arg();
  if (limit !== undefined) {
    console.error(`Limit: processing at most ${limit} entries for LLM triage`);
  }

  const package_name = parse_package_arg();
  if (!package_name) {
    console.error("Error: --package <name> is required.");
    console.error("Usage: npx tsx triage_false_positives.ts --package core");
    process.exit(1);
  }

  // Load ground truth for the specified package
  const ground_truth = await load_ground_truth(package_name);
  console.error(`Loaded ${ground_truth.length} ground truth entries for "${package_name}"`);

  console.error("Finding most recent analysis file...");
  const analysis_file = await find_most_recent_analysis();
  console.error(`Using analysis file: ${analysis_file}`);

  // Load dead code analysis to filter out deleted functions
  let dead_code: DeadCodeAnalysisResult | null = null;
  try {
    console.error("Finding most recent dead code analysis...");
    const dead_code_file = await find_most_recent_dead_code_analysis();
    console.error(`Using dead code file: ${dead_code_file}`);
    dead_code = await load_json(dead_code_file);
  } catch {
    console.error("No dead code analysis found, skipping deletion filter");
  }

  // Load analysis data
  const analysis: AnalysisResult = await load_json(analysis_file);

  // Initialize results
  const results: FalsePositiveTriageResults = {
    groups: {},
    last_updated: new Date().toISOString(),
  };

  // Separate true positives (ground truth matches) from false positives
  const true_positives = analysis.entry_points.filter(
    (ep) => matches_ground_truth(ep, ground_truth)
  );
  const false_positives = analysis.entry_points.filter(
    (ep) => !matches_ground_truth(ep, ground_truth)
  );

  console.error(`\n   True positives (ground truth): ${true_positives.length}`);
  for (const tp of true_positives) {
    console.error(`     ✓ ${tp.name} in ${path.basename(tp.file_path)}`);
  }

  // Filter out functions that were already deleted by dead code analysis
  const after_deleted = dead_code
    ? false_positives.filter((ep) => !is_deleted(ep, dead_code))
    : false_positives;
  const deleted_count = false_positives.length - after_deleted.length;

  // Filter out already processed entries
  const to_process = after_deleted.filter(
    (ep) => !is_already_processed(ep, results)
  );
  const already_processed = after_deleted.length - to_process.length;

  console.error(`\n📊 Total entry points: ${analysis.entry_points.length}`);
  console.error(`   True positives (ground truth): ${true_positives.length}`);
  console.error(`   False positives: ${false_positives.length}`);
  console.error(`   Already deleted: ${deleted_count}`);
  console.error(`   Already grouped: ${already_processed}`);
  console.error(`   To process: ${to_process.length}`);

  // Stage 1: Deterministic pre-classification
  console.error("\n🏷️  Stage 1: Deterministic pre-classification...");
  const classification = classify_entrypoints(to_process);

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
  let entries_analyzed = 0;
  let analysis_error_count = 0;
  const entry_analyses: EntryAnalysis[] = [];

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

      for (const result of raw_results) {
        if (result) {
          entry_analyses.push(result);
          entries_analyzed++;
        }
      }
    } catch (error) {
      console.error(`\n⚠️  Stage 2 error: ${error}`);
    }
  }

  // Stage 3: Aggregation (only if there are entry results to aggregate)
  if (entry_analyses.length > 0) {
    console.error(`\n🧠 Stage 3: Aggregation of ${entry_analyses.length} analyses...`);

    try {
      const aggregation_result = await aggregate_analyses(entry_analyses);
      apply_aggregation_groups(aggregation_result, entry_analyses, results);
    } catch (error) {
      console.error(`\n⚠️  Aggregation failed: ${error}`);
      console.error("   Falling back to per-entry triage groups...");

      // Fallback: use per-entry group assignments directly
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
  await save_json(RESULTS_FILE, results);

  print_summary(results, {
    total_entry_points: analysis.entry_points.length,
    false_positives: false_positives.length,
    deleted: deleted_count,
    already_processed: already_processed,
    pre_classified: pre_classified_count,
    true_positives: classification.true_positives.length,
    entries_analyzed,
    analysis_errors: analysis_error_count,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
