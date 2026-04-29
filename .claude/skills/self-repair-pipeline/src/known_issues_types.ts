/**
 * Temporary re-export shim. The canonical types live in `@ariadnejs/types`'s
 * `known_issues` module; this file is dropped once skill consumers move to
 * the package import directly (see TASK-190.17.13).
 */

export type {
  KnownIssueStatus,
  KnownIssueLanguage,
  KnownIssueExample,
  KnownIssue,
  ClassifierAxis,
  ClassifierSpec,
  PredicateExpr,
  PredicateOperator,
  KnownIssuesRegistry,
} from "@ariadnejs/types";
export { PREDICATE_OPERATORS } from "@ariadnejs/types";
