/** Narrow `unknown` to a Node.js filesystem error code, or null if absent. */
export function error_code(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  if (!("code" in err)) return null;
  const code = (err as { code: unknown }).code;
  return typeof code === "string" ? code : null;
}
