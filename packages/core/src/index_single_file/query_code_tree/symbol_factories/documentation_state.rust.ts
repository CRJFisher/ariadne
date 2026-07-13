import type { Location } from "@ariadnejs/types";

const pending_documentation = new Map<number, string>();

/**
 * Store a Rust doc comment (///) for association with the next definition.
 * Consecutive comments on adjacent lines are concatenated.
 */
export function store_documentation(comment: string, end_line: number): void {
  const prev = pending_documentation.get(end_line - 1);
  if (prev !== undefined) {
    pending_documentation.delete(end_line - 1);
    pending_documentation.set(end_line, prev + "\n" + comment);
  } else {
    pending_documentation.set(end_line, comment);
  }
}

/**
 * Consume the documentation comment preceding the definition at the given location.
 * Checks for a comment ending 1 or 2 lines before the definition starts.
 */
export function consume_documentation(location: Location): string | undefined {
  const def_start_line = location.start_line;
  for (const end_line of [def_start_line - 1, def_start_line - 2]) {
    const doc = pending_documentation.get(end_line);
    if (doc !== undefined) {
      pending_documentation.delete(end_line);
      return doc;
    }
  }
  return undefined;
}

export function reset_documentation_state(): void {
  pending_documentation.clear();
}
