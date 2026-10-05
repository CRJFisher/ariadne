import type { Location } from "@ariadnejs/types";

/**
 * Map to track pending documentation comments by line number
 * Key: end line of comment, Value: comment text
 */
const pending_documentation = new Map<number, string>();

/**
 * Store documentation comment for association with next definition
 */
export function store_documentation(comment: string, end_line: number): void {
  pending_documentation.set(end_line, comment);
}

/**
 * Consume documentation for a definition at the given location
 * Returns the documentation if found within 1-2 lines before the definition
 */
export function consume_documentation(location: Location): string | undefined {
  const def_start_line = location.start_line;

  // Check for comment ending 1 or 2 lines before definition
  for (const end_line of [def_start_line - 1, def_start_line - 2]) {
    const doc = pending_documentation.get(end_line);
    if (doc) {
      pending_documentation.delete(end_line);
      return doc;
    }
  }

  return undefined;
}

/**
 * Reset documentation state between file indexing passes to prevent cross-file contamination
 */
export function reset_documentation_state(): void {
  pending_documentation.clear();
}
