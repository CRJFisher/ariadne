/**
 * Result type for operations that can fail with structured error information.
 *
 * Discriminated-union form mirrors the project's existing union conventions
 * (e.g., `IndirectReachabilityReason`). Use the `ok` / `err` constructors and
 * the `is_ok` / `is_err` type guards rather than constructing the variants
 * by hand.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function is_ok<T, E>(
  r: Result<T, E>
): r is { readonly ok: true; readonly value: T } {
  return r.ok;
}

export function is_err<T, E>(
  r: Result<T, E>
): r is { readonly ok: false; readonly error: E } {
  return !r.ok;
}
