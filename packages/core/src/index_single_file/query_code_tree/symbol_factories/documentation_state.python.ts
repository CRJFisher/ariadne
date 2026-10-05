import type { CaptureNode } from "../../capture_types";

const pending_python_docstrings = new Map<number, string>();

/**
 * Store a Python docstring keyed by the start line of its containing definition.
 * Traverses up from the captured string node to find the function_definition
 * or class_definition that owns it.
 */
export function store_python_docstring(capture: CaptureNode): void {
  const string_node = capture.node;
  const def_node = string_node.parent?.parent?.parent;
  if (!def_node) return;
  if (def_node.type !== "function_definition" && def_node.type !== "class_definition") return;

  const start_line = def_node.startPosition.row + 1;
  pending_python_docstrings.set(start_line, clean_python_docstring(capture.text));
}

/**
 * Consume a stored docstring for the definition starting at the given line.
 */
export function consume_python_docstring(start_line: number): string | undefined {
  const doc = pending_python_docstrings.get(start_line);
  if (doc !== undefined) {
    pending_python_docstrings.delete(start_line);
    return doc;
  }
  return undefined;
}

export function reset_documentation_state(): void {
  pending_python_docstrings.clear();
}

/**
 * Strip surrounding triple-quotes and normalise leading indent from a raw Python docstring.
 */
export function clean_python_docstring(raw: string): string {
  let content = raw;
  if (content.startsWith("\"\"\"") && content.endsWith("\"\"\"")) {
    content = content.slice(3, -3);
  } else if (content.startsWith("'''") && content.endsWith("'''")) {
    content = content.slice(3, -3);
  }

  const lines = content.split("\n");

  // Remove leading/trailing blank lines
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  if (lines.length === 0) return "";

  // Find common indent across non-empty lines
  const non_empty = lines.filter(l => l.trim() !== "");
  const min_indent = Math.min(...non_empty.map(l => (l.match(/^(\s*)/)?.[1].length ?? 0)));

  return lines.map(l => l.slice(min_indent)).join("\n");
}
