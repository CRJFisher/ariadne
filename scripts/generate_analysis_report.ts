/**
 * Generate comprehensive capture analysis report
 * Task 11.154.1 - Document Current Capture State
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { extract_all_captures, CaptureInfo } from "./extract_captures.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename_esm = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname_esm = dirname(__filename_esm);

// Compute statistics
function compute_stats(captures: CaptureInfo[]) {
  const by_category = new Map<string, number>();
  const by_entity = new Map<string, number>();
  const unique_names = new Set<string>();

  for (const capture of captures) {
    unique_names.add(capture.name);
    if (capture.category) {
      by_category.set(capture.category, (by_category.get(capture.category) || 0) + 1);
    }
    if (capture.entity) {
      by_entity.set(capture.entity, (by_entity.get(capture.entity) || 0) + 1);
    }
  }

  return {
    total: captures.length,
    unique: unique_names.size,
    by_category: Object.fromEntries(by_category),
    by_entity: Object.fromEntries(by_entity)
  };
}

// Find common captures
function find_common(by_language: Map<string, CaptureInfo[]>): string[] {
  const languages = Array.from(by_language.keys());
  if (languages.length === 0) return [];

  const names_by_language = new Map<string, Set<string>>();
  for (const [lang, captures] of by_language) {
    names_by_language.set(lang, new Set(captures.map(c => c.name)));
  }

  const common = new Set(names_by_language.get(languages[0])!);
  for (let i = 1; i < languages.length; i++) {
    const lang_names = names_by_language.get(languages[i])!;
    for (const name of common) {
      if (!lang_names.has(name)) {
        common.delete(name);
      }
    }
  }

  return Array.from(common).sort();
}

// Find language-specific captures
function find_language_specific(by_language: Map<string, CaptureInfo[]>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const names_by_language = new Map<string, Set<string>>();

  for (const [lang, captures] of by_language) {
    names_by_language.set(lang, new Set(captures.map(c => c.name)));
  }

  for (const [lang, names] of names_by_language) {
    const specific: string[] = [];
    for (const name of names) {
      let found_in_other = false;
      for (const [other_lang, other_names] of names_by_language) {
        if (other_lang !== lang && other_names.has(name)) {
          found_in_other = true;
          break;
        }
      }
      if (!found_in_other) {
        specific.push(name);
      }
    }
    if (specific.length > 0) {
      result.set(lang, specific.sort());
    }
  }

  return result;
}

// Find duplicate patterns
function find_duplicates(by_language: Map<string, CaptureInfo[]>) {
  const duplicates = [];

  // Method call duplicates
  const method_duplicates = {
    name: "Method Call Duplicates",
    captures: [] as string[],
    languages: [] as string[],
    examples: [] as string[]
  };

  for (const [lang, captures] of by_language) {
    const has_full = captures.some(c => c.name === "@reference.call.full");
    const has_chained = captures.some(c => c.name === "@reference.call.chained");
    const has_deep = captures.some(c => c.name === "@reference.call.deep");

    if (has_full || has_chained || has_deep) {
      method_duplicates.languages.push(lang);
      const examples = captures.filter(c =>
        c.name === "@reference.call.full" ||
        c.name === "@reference.call.chained" ||
        c.name === "@reference.call.deep"
      ).slice(0, 2);

      for (const ex of examples) {
        if (!method_duplicates.captures.includes(ex.name)) {
          method_duplicates.captures.push(ex.name);
        }
        method_duplicates.examples.push(`${lang}:${ex.line} - ${ex.context}`);
      }
    }
  }

  if (method_duplicates.languages.length > 0) {
    duplicates.push(method_duplicates);
  }

  return duplicates;
}

// Generate markdown report
function generate_report() {
  console.log("Generating capture analysis report...\n");

  const by_language = extract_all_captures();
  const common = find_common(by_language);
  const language_specific = find_language_specific(by_language);
  const duplicates = find_duplicates(by_language);

  let md = `# Capture Schema Analysis

**Date**: ${new Date().toISOString().split("T")[0]}
**Languages Analyzed**: TypeScript, JavaScript, Python, Rust
**Purpose**: Inform canonical schema design for Task 11.154

---

## Executive Summary

`;

  // Statistics
  md += "### Capture Statistics\n\n";
  md += "| Language | Total Captures | Unique Captures | Categories | Entities |\n";
  md += "|----------|----------------|-----------------|------------|----------|\n";

  for (const [lang, captures] of by_language) {
    const stats = compute_stats(captures);
    md += `| ${lang} | ${stats.total} | ${stats.unique} | ${Object.keys(stats.by_category).length} | ${Object.keys(stats.by_entity).length} |\n`;
  }

  md += "\n### Key Findings\n\n";
  md += `- **Common captures** (in ALL languages): ${common.length}\n`;
  md += `- **Duplicate patterns identified**: ${duplicates.length}\n`;

  let total_language_specific = 0;
  for (const [, specifics] of language_specific) {
    total_language_specific += specifics.length;
  }
  md += `- **Language-specific captures**: ${total_language_specific}\n`;

  md += "\n---\n\n## Common Captures\n\n";
  md += "These captures appear in ALL four languages:\n\n";
  for (const capture of common) {
    md += `- \`${capture}\`\n`;
  }

  md += "\n---\n\n## Duplicate Pattern Analysis\n\n";

  for (const dup of duplicates) {
    md += `### ${dup.name}\n\n`;
    md += `**Problematic captures**: ${dup.captures.map(c => `\`${c}\``).join(", ")}\n\n`;
    md += `**Found in**: ${dup.languages.join(", ")}\n\n`;
    md += "**Issue**: Creates multiple captures for the same syntactic construct, causing ambiguity in reference resolution and false self-references in call graph detection.\n\n";
    md += "**Examples**:\n```\n";
    for (const ex of dup.examples.slice(0, 6)) {
      md += `${ex}\n`;
    }
    md += "```\n\n";
    md += "**Recommendation**: Use single capture on call_expression node only. Extract method name via metadata extractors.\n\n";
  }

  md += "---\n\n## Language-Specific Captures\n\n";

  for (const [lang, specifics] of language_specific) {
    md += `### ${lang.charAt(0).toUpperCase() + lang.slice(1)}-Specific (${specifics.length} captures)\n\n`;
    for (const capture of specifics.slice(0, 20)) {
      md += `- \`${capture}\`\n`;
    }
    if (specifics.length > 20) {
      md += `- ... and ${specifics.length - 20} more\n`;
    }
    md += "\n";
  }

  md += "---\n\n## Detailed Statistics by Language\n\n";

  for (const [lang, captures] of by_language) {
    const stats = compute_stats(captures);
    md += `### ${lang.charAt(0).toUpperCase() + lang.slice(1)}\n\n`;
    md += `- **Total captures**: ${stats.total}\n`;
    md += `- **Unique captures**: ${stats.unique}\n\n`;

    md += "**By Category**:\n";
    const sorted_categories = Object.entries(stats.by_category).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted_categories) {
      md += `- ${cat}: ${count}\n`;
    }

    md += "\n**By Entity** (top 10):\n";
    const sorted_entities = Object.entries(stats.by_entity).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [ent, count] of sorted_entities) {
      md += `- ${ent}: ${count}\n`;
    }

    md += "\n";
  }

  md += "---\n\n## Recommendations for Canonical Schema\n\n";
  md += "### Required Captures\n\n";
  md += "Based on common captures, these should be required in all languages:\n\n";
  for (const capture of common.filter(c => !c.includes(".full") && !c.includes(".chained")).slice(0, 30)) {
    md += `- \`${capture}\` - [Description needed]\n`;
  }

  md += "\n### Prohibited Patterns\n\n";
  md += "These patterns should be explicitly prohibited:\n\n";
  md += "1. **Duplicate method call captures**: `@reference.call.full`, `@reference.call.chained`, `@reference.call.deep`\n";
  md += "   - **Reason**: Creates duplicate captures causing false self-references\n";
  md += "   - **Alternative**: Single `@reference.call` on call_expression node\n\n";

  md += "2. **Over-nesting** (>3 parts): `@a.b.c.d`\n";
  md += "   - **Reason**: Indicates over-granular captures\n";
  md += "   - **Alternative**: Simplify to `@category.entity.qualifier`\n\n";

  md += "---\n\n## Next Steps\n\n";
  md += "1. Review findings with team\n";
  md += "2. Use this analysis to design canonical schema (Task 11.154.2)\n";
  md += "3. Prioritize fixes by impact\n";

  return md;
}

// Write report
const report = generate_report();
const output_path = path.join(__dirname_esm, "../backlog/tasks/epics/epic-11-codebase-restructuring/CAPTURE-SCHEMA-ANALYSIS.md");
fs.writeFileSync(output_path, report);

console.log(`\n✓ Report generated: ${output_path}`);
