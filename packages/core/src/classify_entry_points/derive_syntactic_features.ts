/**
 * Compose `SyntacticFeatures` for a call site from its `CallReference` and the
 * source-line text. Core does not emit these flags directly — they are
 * assembled here so builtin classifiers can read them uniformly.
 *
 * Registry entries today use `is_super_call` and `is_dynamic_dispatch`; the
 * remaining flags are populated best-effort for future entries. `is_inside_try`
 * has no syntactic source and stays `false`.
 */

import type { CallReference, SyntacticFeatures } from "@ariadnejs/types";

export function derive_syntactic_features(
  call_ref: CallReference,
  source_line: string,
): SyntacticFeatures {
  const receiver_kind = call_ref.call_site_syntax?.receiver_kind;
  const index_key_is_literal = call_ref.call_site_syntax?.index_key_is_literal;
  return {
    is_new_expression: call_ref.call_type === "constructor",
    // Core emits `receiver_kind: "self_keyword"` for this/self/super/cls, so
    // super is isolated by a textual check on the call-site line instead.
    is_super_call: /\bsuper\s*\./.test(source_line),
    is_optional_chain: /\?\./.test(source_line),
    is_awaited: /\bawait\s/.test(source_line),
    is_callback_arg: call_ref.is_callback_invocation === true,
    is_inside_try: false,
    is_dynamic_dispatch:
      receiver_kind === "index_access" && index_key_is_literal === false,
  };
}
