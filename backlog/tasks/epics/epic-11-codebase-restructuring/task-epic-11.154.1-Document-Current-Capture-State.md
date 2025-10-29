# Task Epic 11.154.1: Document Current Capture State

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Low
**Time Estimate**: 1 day

---

## Objective

Create a comprehensive inventory of all current capture patterns across all four languages to inform the canonical schema design.

---

## Context

Before designing a canonical schema, we need to understand:

- What captures currently exist in each language
- Which captures are duplicates/redundant
- How captures map to our semantic model
- What language-specific captures are truly necessary

This analysis will directly inform Phase 2 (Schema Design).

---

## Deliverables

### 1. Capture Inventory Document

**File**: `backlog/tasks/epics/epic-11-codebase-restructuring/CAPTURE-SCHEMA-ANALYSIS.md`

**Required sections:**

#### Section 1: Capture Statistics

```markdown
## Capture Statistics

| Language   | Total Captures | Unique Captures | By Category | By Entity |
| ---------- | -------------- | --------------- | ----------- | --------- |
| TypeScript | 118            | 118             | ...         | ...       |
| JavaScript | 79             | 79              | ...         | ...       |
| Python     | 79             | 79              | ...         | ...       |
| Rust       | 117            | 117             | ...         | ...       |
```

#### Section 2: Common Captures

List of captures that appear in ALL languages with consistent naming

#### Section 3: Language-Specific Captures

Captures unique to each language (with justification for why they're needed)

#### Section 4: Duplicate Pattern Analysis

Identify all instances of duplicate captures (e.g., `@reference.call` + `@reference.call.full`)

#### Section 5: Mapping to Semantic Model

Table showing how captures map to `SemanticCategory` and `SemanticEntity` enums

#### Section 6: Naming Inconsistencies

Cases where similar concepts use different names across languages

### 2. Raw Data Files

**Directory**: `/tmp/capture_analysis/`

Create these files for analysis:

- `typescript_captures.txt` - All TypeScript captures
- `javascript_captures.txt` - All JavaScript captures
- `python_captures.txt` - All Python captures
- `rust_captures.txt` - All Rust captures
- `common_captures.txt` - Captures in all languages
- `language_specific.txt` - Captures unique to one language

---

## Implementation Steps

### Step 1: Extract Captures from Query Files

Create script: `scripts/extract_captures.ts`

```typescript
/**
 * Extract all captures from a .scm file
 */
export function extract_captures_from_scm(file_path: string): CaptureInfo[] {
  const content = fs.readFileSync(file_path, "utf-8");
  const captures: CaptureInfo[] = [];

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match capture patterns: @capture.name
    const matches = line.matchAll(/@([a-z_]+(?:\.[a-z_]+)*)/g);

    for (const match of matches) {
      const capture_name = match[1];
      const parts = capture_name.split(".");

      captures.push({
        name: `@${capture_name}`,
        category: parts[0],
        entity: parts[1],
        qualifiers: parts.slice(2),
        line: i + 1,
        context: line.trim(),
      });
    }
  }

  return captures;
}

interface CaptureInfo {
  name: string;
  category: string;
  entity: string;
  qualifiers: string[];
  line: number;
  context: string;
}
```

### Step 2: Analyze Captures

Create script: `scripts/analyze_captures.ts`

```typescript
/**
 * Analyze captures across all languages
 */
export function analyze_all_captures(): AnalysisReport {
  const languages = ["typescript", "javascript", "python", "rust"];
  const by_language = new Map<string, CaptureInfo[]>();

  // Extract from each language
  for (const lang of languages) {
    const file_path = `packages/core/src/index_single_file/query_code_tree/queries/${lang}.scm`;
    const captures = extract_captures_from_scm(file_path);
    by_language.set(lang, captures);
  }

  // Find common captures
  const common = find_common_captures(by_language);

  // Find language-specific
  const language_specific = find_language_specific_captures(by_language);

  // Find duplicates
  const duplicates = find_duplicate_patterns(by_language);

  // Map to semantic model
  const semantic_mapping = map_to_semantic_model(by_language);

  return {
    by_language,
    common,
    language_specific,
    duplicates,
    semantic_mapping,
    stats: compute_stats(by_language),
  };
}
```

### Step 3: Generate Report

```typescript
/**
 * Generate markdown report
 */
export function generate_report(analysis: AnalysisReport): string {
  let md = "# Capture Schema Analysis\n\n";

  // Add statistics table
  md += "## Capture Statistics\n\n";
  md += generate_stats_table(analysis.stats);

  // Add common captures
  md += "\n## Common Captures\n\n";
  md += "Captures that appear in ALL languages:\n\n";
  for (const capture of analysis.common) {
    md += `- \`${capture.name}\` - ${capture.description}\n`;
  }

  // Add language-specific
  md += "\n## Language-Specific Captures\n\n";
  for (const [lang, captures] of analysis.language_specific) {
    md += `### ${lang}\n\n`;
    for (const capture of captures) {
      md += `- \`${capture.name}\` - ${capture.justification}\n`;
    }
  }

  // Add duplicate analysis
  md += "\n## Duplicate Pattern Analysis\n\n";
  for (const duplicate of analysis.duplicates) {
    md += `### ${duplicate.pattern}\n\n`;
    md += `Found in: ${duplicate.languages.join(", ")}\n\n`;
    md += `Example:\n\`\`\`scheme\n${duplicate.example}\n\`\`\`\n\n`;
    md += `**Issue**: ${duplicate.issue}\n\n`;
  }

  return md;
}
```

### Step 4: Run Analysis

```bash
npx tsx scripts/analyze_captures.ts > backlog/tasks/epics/epic-11-codebase-restructuring/CAPTURE-SCHEMA-ANALYSIS.md
```

### Step 5: Manual Review and Annotation

Go through `CAPTURE-SCHEMA-ANALYSIS.md` and add:

1. **Justifications** for language-specific captures

   - Why does Python need `@reference.call.full` if others don't?
   - Is this truly language-specific or just inconsistent?

2. **Categories** for duplicates

   - Which duplicates are problematic? (e.g., method calls)
   - Which are acceptable? (e.g., optional qualifiers)

3. **Mapping validation**

   - Does every capture map to a valid SemanticCategory/Entity?
   - Are there captures we don't actually use?

4. **Recommendations**
   - Which captures should be required?
   - Which should be optional?
   - Which should be prohibited?

---

## Acceptance Criteria

- [ ] Script `scripts/extract_captures.ts` can parse all .scm files
- [ ] Script `scripts/analyze_captures.ts` generates complete analysis
- [ ] `CAPTURE-SCHEMA-ANALYSIS.md` contains all required sections
- [ ] All capture statistics are accurate (manual spot-check)
- [ ] Duplicate patterns are identified with examples
- [ ] Language-specific captures have justifications
- [ ] Mapping to semantic model is complete
- [ ] Manual review annotations added
- [ ] Document reviewed by at least one other developer

---

## Output Template

Use this structure for `CAPTURE-SCHEMA-ANALYSIS.md`:

```markdown
# Capture Schema Analysis

**Date**: 2025-10-29
**Languages Analyzed**: TypeScript, JavaScript, Python, Rust
**Purpose**: Inform canonical schema design for Task 11.154

---

## Executive Summary

[High-level findings]

- Total unique capture patterns: XXX
- Common patterns across all languages: XXX
- Language-specific patterns: XXX
- Duplicate patterns identified: XXX
- Problematic patterns requiring fixes: XXX

---

## Capture Statistics

[Generated table]

---

## Common Captures

[List of captures in ALL languages]

---

## Language-Specific Captures

### TypeScript-Specific

[Captures unique to TypeScript with justifications]

### JavaScript-Specific

[Captures unique to JavaScript with justifications]

### Python-Specific

[Captures unique to Python with justifications]

### Rust-Specific

[Captures unique to Rust with justifications]

---

## Duplicate Pattern Analysis

### Pattern 1: Method Call Duplicates

**Captures**: `@reference.call` + `@reference.call.full`
**Found in**: All languages
**Issue**: Creates two captures for single method call, causing false self-references
**Recommendation**: Prohibit `.full` qualifier, use single capture

[More duplicate patterns...]

---

## Mapping to Semantic Model

[Table showing capture → SemanticCategory/Entity mappings]

---

## Naming Inconsistencies

[Cases where similar concepts use different names]

---

## Recommendations for Canonical Schema

### Required Captures

[List with rationale]

### Optional Captures

[List with rationale]

### Prohibited Patterns

[List with rationale]

### Naming Convention

[Proposed standard]

---

## Next Steps

1. Review findings with team
2. Use this analysis to design canonical schema (Task 11.154.2)
3. Prioritize fixes by impact
```

---

## Dependencies

**None** - This is the first subtask

---

## Blocks

- **Task 11.154.2** - Schema design depends on this analysis
- **Task 11.154.3** - Validation implementation needs schema definition

---

## Notes

### Tips for Analysis

1. **Start with commonalities** - What do all languages already agree on?
2. **Identify root causes** - Why do duplicates exist? Copy-paste? Evolution?
3. **Consider AST differences** - Python uses `attribute`, JS uses `member_expression` - both valid
4. **Think semantically** - What does this capture _mean_, not just what it _matches_

### Questions to Answer

- Are there captures we create but never use?
- Are there semantic concepts we need but don't capture?
- Can we reduce the total number of unique captures?
- What's the minimum viable capture schema?

### Watch Out For

- **False equivalence** - Similar names might mean different things across languages
- **Missing context** - Some captures might be used in unexpected ways
- **Historical baggage** - Some patterns might be obsolete

---

## Success Metrics

- Analysis document is comprehensive (>2000 words)
- All stakeholders agree findings are accurate
- Provides clear direction for schema design
- Identifies all problematic duplicate patterns
- Team can use this as reference for implementation

---

## Time Breakdown

- **Script writing**: 2 hours
- **Running analysis**: 30 minutes
- **Manual review and annotation**: 3 hours
- **Team review**: 2 hours
- **Revisions**: 30 minutes

**Total: 1 day (8 hours)**
