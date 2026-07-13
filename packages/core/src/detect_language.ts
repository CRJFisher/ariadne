import type { Language } from "@ariadnejs/types";

/**
 * The single path-based language detector. Callers are ingress sites only —
 * the parse dispatch (`project/parse_file.ts`), file-discovery filtering, and
 * skill-side loaders that re-enter persisted data from JSON. Code downstream
 * of a parse reads the language carried from ingress instead of re-deriving
 * it from the path.
 */
export function detect_language(file_path: string): Language | null {
  if (file_path.endsWith(".ts") || file_path.endsWith(".tsx")) {
    return "typescript";
  }
  if (
    file_path.endsWith(".js") ||
    file_path.endsWith(".jsx") ||
    file_path.endsWith(".mjs") ||
    file_path.endsWith(".cjs")
  ) {
    return "javascript";
  }
  if (file_path.endsWith(".py")) {
    return "python";
  }
  if (file_path.endsWith(".rs")) {
    return "rust";
  }
  // go, java, cpp are recognized by find_source_files but not supported by
  // the Language type, so they detect as null.
  return null;
}

export function assert_language(file_path: string): Language {
  const language = detect_language(file_path);
  if (language === null) {
    const ext = file_path.split(".").pop()?.toLowerCase();
    throw new Error(`Unsupported file extension: ${ext}`);
  }
  return language;
}
