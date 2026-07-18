/**
 * Pure logic for the detect_language singleton Stop guard.
 *
 * The invariant (TASK-362.1): exactly one `detect_language(path): Language|null`
 * definition lives at packages/core/src/detect_language.ts. Every other
 * appearance of the name must be an import or call site — a second definition
 * re-opens the fork bug where unknown extensions silently defaulted to a
 * language instead of returning null.
 *
 * Pure string/path predicates only — the fs walk and git trigger live in the
 * entry file so tests run on fixture strings.
 */

export const CANONICAL_PATH = "packages/core/src/detect_language.ts";

export const SINGLETON_INSTRUCTION =
  "exactly one `detect_language(path): Language|null` lives at " +
  "`packages/core/src/detect_language.ts`; import it, never re-define; " +
  "unknown extensions return `null`, never default to a language.";

export interface DefinitionSite {
  file: string;
  line: number;
}

// Anchored on DEFINITION forms only. `declare` between `export` and
// `function` breaks the match, so dist .d.ts declarations are rejected even
// before the path filter prunes them. `\b[^=\n]*=` on the const form allows a
// type annotation between the name and `=` while `\b` rejects longer names
// like detect_language_map.
const FUNCTION_DEF = /^\s*(export\s+)?(async\s+)?function\s+detect_language\s*\(/;
const CONST_DEF = /^\s*(export\s+)?const\s+detect_language\b[^=\n]*=/;

export function is_scannable_source_path(rel_path: string): boolean {
  return (
    rel_path.startsWith("packages/") &&
    rel_path.endsWith(".ts") &&
    !rel_path.endsWith(".test.ts") &&
    !rel_path.endsWith(".d.ts") &&
    !rel_path.includes("/dist/") &&
    !rel_path.includes("/node_modules/")
  );
}

export function find_definition_lines(content: string): number[] {
  const lines = content.split("\n");
  const matches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (FUNCTION_DEF.test(lines[i]) || CONST_DEF.test(lines[i])) {
      matches.push(i + 1);
    }
  }
  return matches;
}

export function find_singleton_offenders(defs: DefinitionSite[]): DefinitionSite[] {
  const canonical = defs.filter((d) => d.file === CANONICAL_PATH);
  const foreign = defs.filter((d) => d.file !== CANONICAL_PATH);
  // Duplicates inside the canonical file offend too — list every canonical
  // site so the message shows both lines, not just the surplus one.
  return canonical.length > 1 ? [...foreign, ...canonical] : foreign;
}

export function format_violation(offenders: DefinitionSite[]): string {
  const listing = offenders.map((o) => `  ${o.file}:${o.line}`).join("\n");
  return (
    "detect_language is defined in more than one place or outside its canonical home:\n" +
    `${listing}\n\n${SINGLETON_INSTRUCTION}`
  );
}
