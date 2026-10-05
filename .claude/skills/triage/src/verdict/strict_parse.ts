/**
 * Strict JSON-shape parsing primitives used by `triage_verdict.ts`. The
 * contract is "no silent coercion": every helper throws on shape violation so
 * downstream code can assume fully validated values.
 */

export function is_record(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

export function expect_object(raw: unknown, ctx: string): Record<string, unknown> {
  if (!is_record(raw)) {
    throw new Error(`${ctx}: expected object, got ${describe(raw)}`);
  }
  return raw;
}

export function assert_keys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  ctx: string,
): void {
  for (const key of allowed) {
    if (!(key in obj)) {
      throw new Error(`${ctx}: missing required field '${key}'`);
    }
  }
  const allowed_set = new Set<string>(allowed);
  for (const key of Object.keys(obj)) {
    if (!allowed_set.has(key)) {
      throw new Error(`${ctx}: unexpected field '${key}'`);
    }
  }
}

export function parse_non_empty_string(raw: unknown, ctx: string): string {
  if (typeof raw !== "string") {
    throw new Error(`${ctx}: must be a string, got ${describe(raw)}`);
  }
  if (raw.length === 0) {
    throw new Error(`${ctx}: must be non-empty`);
  }
  return raw;
}

export function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
