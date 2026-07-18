/**
 * Resolution-failure diagnostics emitted by the resolver at call sites it
 * cannot resolve, plus the syntactic call-site observations classifiers
 * compose them with.
 */

import type { SymbolId } from "./symbol";
import type { FilePath } from "./location";
import type { ScopeId } from "./scopes";

/**
 * Resolver pipeline stage that produced a `ResolutionFailure`.
 */
export type ResolutionFailureStage =
  | "name_resolution"
  | "receiver_resolution"
  | "method_lookup"
  | "import_resolution"
  | "type_inference"
  | "constructor_lookup"
  | "collection_dispatch";

/**
 * Specific reason a call failed to resolve. Each value names **a single
 * observation the resolver made about its own internal state** — never a
 * classifier verdict or failure category. Values read as "the resolver got
 * as far as X and observed Y," not as "this is an F-coded failure mode."
 *
 * Downstream classifiers (in `.claude/skills/triage`) compose
 * these observations with syntactic facts to produce taxonomic labels; the
 * enum itself stays taxonomy-free. New resolver paths must extend this enum
 * so classifiers can pattern-match exhaustively.
 */
export type ResolutionFailureReason =
  | "name_not_in_scope"
  | "import_unresolved"
  | "reexport_chain_unresolved"
  | "receiver_type_unknown"
  | "method_not_on_type"
  | "polymorphic_no_implementations"
  | "collection_dispatch_miss"
  | "dynamic_dispatch"
  | "no_enclosing_class_scope"
  | "class_definition_not_found"
  | "no_parent_class"
  | "member_type_unknown"
  | "definition_has_no_body_scope"
  | "constructor_target_not_a_class";

/**
 * Diagnostic emitted by the resolver when a call cannot be resolved.
 *
 * Populated on `CallReference.resolution_failure` only when
 * `resolutions.length === 0`. The triple `(stage, reason, partial_info)`
 * carries enough context for downstream classifiers (auto-classify pipeline
 * stage) to deterministically distinguish failure modes without re-running
 * the resolver.
 */
export interface ResolutionFailure {
  readonly stage: ResolutionFailureStage;
  readonly reason: ResolutionFailureReason;
  readonly partial_info: {
    readonly resolved_receiver_type?: SymbolId;
    readonly import_target_file?: FilePath;
    readonly last_known_scope?: ScopeId;
  };
}

/**
 * Syntactic shape of a method-call receiver.
 *
 * Populated on `CallSiteSyntax.receiver_kind` only when `call_type === "method"`
 * (function / constructor calls are discriminated by `call_type` itself).
 * Closed union — new variants force a types-package bump so classifiers stay
 * exhaustive, mirroring the `ResolutionFailureReason` pattern.
 *
 * Variant meanings:
 * - `identifier`         — `obj.m()`
 * - `self_keyword`       — `this.m()` / `self.m()` / `super.m()` / `cls.m()`
 * - `member_expression`  — `a.b.m()` (nested member access as receiver)
 * - `call_chain`         — `foo().m()` (receiver is itself a call)
 * - `index_access`       — `arr[k].m()` (receiver is an index/subscript)
 * - `type_cast`          — `(x as T).m()` @language typescript
 * - `parenthesized`      — `(expr).m()` (wraps any non-trivial expression)
 * - `non_null_assertion` — `x!.m()` @language typescript
 */
export type ReceiverKind =
  | "identifier"
  | "self_keyword"
  | "member_expression"
  | "call_chain"
  | "index_access"
  | "type_cast"
  | "parenthesized"
  | "non_null_assertion";

/**
 * Call-site syntactic context.
 *
 * Carries deterministic, purely syntactic signals any downstream consumer can
 * key off. Two discriminators accompany `receiver_kind`, each populated only
 * when it resolves a specific ambiguity that pure `receiver_kind` cannot:
 *
 * - `receiver_call_target_lexical_shape` — set only when
 *   `receiver_kind === "call_chain"`. Distinguishes receiver-call targets that
 *   lexically *look* class-like (`PascalCase`, suggesting instantiation) from
 *   function-like (all-lowercase, suggesting factory) or unknown shapes. The
 *   shape is purely lexical — core does no type inference here.
 *
 * - `index_key_is_literal` — set only when `receiver_kind === "index_access"`.
 *   Whether the subscript key is a literal (`a["k"].m()`) or a computed
 *   expression (`a[k].m()`).
 *
 * These are observational facts about the AST. They are not classifier outputs
 * and do not encode any taxonomy; classifiers (in
 * `.claude/skills/triage`) compose them with other signals to
 * produce labels.
 */
export interface CallSiteSyntax {
  readonly receiver_kind: ReceiverKind;
  readonly receiver_call_target_lexical_shape?: "class_like" | "function_like" | "unknown";
  readonly index_key_is_literal?: boolean;
}
