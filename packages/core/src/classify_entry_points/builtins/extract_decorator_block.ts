// Shared helper for decorator-matching builtin classifiers.
//
// Extracts the lines immediately preceding a definition's start line that look
// like language-level decorators/attributes. Best-effort and language-loose —
// catches Python `@decorator`, TypeScript `@Component(...)`, and Rust
// `#[attribute]` / `#![attribute]`. Stops at the first non-decorator line
// walking upward, which bounds the work to the immediate decorator run.

export function extract_decorator_block(
  lines: readonly string[],
  start_line_1_based: number,
): string {
  const collected: string[] = [];
  for (let i = start_line_1_based - 2; i >= 0; i--) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith("@") || trimmed.startsWith("#[") || trimmed.startsWith("#![")) {
      collected.unshift(line);
      continue;
    }
    break;
  }
  return collected.join("\n");
}
