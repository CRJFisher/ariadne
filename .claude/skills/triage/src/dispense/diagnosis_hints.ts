/**
 * Per-diagnosis investigation guidance. Each diagnosis route names how
 * detection saw (or failed to see) an entry's callers; its hints tell the
 * investigator where to look first and how the route maps onto a verdict.
 *
 * Every guide is part of the investigator's constant system prompt, so none
 * names a particular entry: the entry's name, file and evidence arrive in the
 * first user message.
 */

export interface DiagnosisHints {
  title: string;
  summary: string;
  investigation_guide: string;
}

export const GENERIC_HINTS: DiagnosisHints = {
  title: "No Textual Callers",
  summary:
    "Grep found no call site for this name anywhere in the indexed corpus, and detection saw no non-call reference either. Whether a caller exists depends on forms a call-syntax grep cannot see.",
  investigation_guide: [
    "1. Read the definition and its surroundings: what it is for, how its file exports it, whether its class implements a protocol.",
    "2. Search in one turn, in parallel, for the forms a call-syntax grep misses: the bare name (callbacks, registrations, re-exports, `__all__`), the name as a string literal (string-keyed dispatch, `getattr`, decorators, configuration), and, for a method, `.name` on any receiver.",
    "3. Check the language's implicit invocation: Python dunder methods, Rust trait impls and macros, JavaScript getters, setters and `Symbol` keys, framework lifecycle hooks invoked by in-repo code.",
    "4. Nothing reaches it ⇒ `tp`, with `why` naming the searches that ruled callers out. A caller found ⇒ `fp-novel`, or `fp-classifier-regression` when an in-scope rule's intent covers it.",
  ].join("\n"),
};

export const DIAGNOSIS_HINTS: Record<string, DiagnosisHints> = {
  "callers-outside-indexed-corpus": {
    title: "Callers Outside the Indexed Corpus",
    summary:
      "The caller exists, in a file that was discovered but never indexed — held out by a project-config `exclude`, left outside a `--folders` scope, or dropped by an indexing error. This is a statement about coverage, not about the member.",
    investigation_guide: [
      "1. Read each out-of-index hit. Each names a file the walk found and the index did not.",
      "2. Confirm the hit is a real invocation of this member, not a comment, a string or a same-named sibling.",
      "3. A real caller in an unindexed file ⇒ `fp-novel`, with the coverage gap (an `exclude`, a folder scope, an indexing error) as the root cause. No real caller among the hits ⇒ investigate as for No Textual Callers.",
    ].join("\n"),
  },
  "references-without-call-syntax": {
    title: "Reached Without Call Syntax",
    summary:
      "Nothing calls this member with parens, but the indexed corpus references it: a getter read, a callback handed to an invoker, a dict or list registration value. The reference sites carry the evidence; the grep call-site list is empty by construction.",
    investigation_guide: [
      "1. Read each reference site. Its tags give the reference kind, the access type and the receiver form.",
      "2. Decide whether the reference is an invocation route: a callback passed to an invoker that later calls it, or a registration value in a table dispatched through a computed key, reaches the member; a read that never invokes does not.",
      "3. The reference index keys on the name alone, so confirm the referenced name is this member and not a same-named one elsewhere.",
      "4. Reached by reference ⇒ `fp-novel` naming the invocation route (or `fp-classifier-regression` when an in-scope rule's intent covers it). Never invoked ⇒ `tp`.",
    ].join("\n"),
  },
  "callers-not-in-registry": {
    title: "Callers Not in Registry",
    summary:
      "Grep found call sites for this name in indexed files, but Ariadne produced no call reference for them: the calls exist in the code and the extractor never captured them.",
    investigation_guide: [
      "1. Read each grep call site. Confirm it invokes this member, not a comment, a string or a same-named sibling on an unrelated receiver.",
      "2. A grep hit whose captures are empty is a textual call the extractor produced no call reference for. Name the syntax that hid it: a decorator, a chained or parenthesised receiver, a template, a macro, an unusual call form.",
      "3. Real callers ⇒ `fp-novel` with the uncaptured call form as the root cause (or `fp-classifier-regression` when an in-scope rule's intent covers it). Every hit is a false match and nothing else calls it ⇒ `tp`.",
    ].join("\n"),
  },
  "callers-in-registry-unresolved": {
    title: "Resolution Failure",
    summary:
      "Ariadne extracted call references matching this name, but resolution linked none of them to this definition. The calls are indexed but not linked.",
    investigation_guide: [
      "1. Read the Ariadne call references. `failure` names the resolution stage and reason verbatim, `receiver` the receiver's syntactic form; start from them.",
      "2. Read the call sites and decide whether each really reaches this definition: follow aliased or destructured imports, barrel re-exports, the receiver's type, the class hierarchy, mixins and prototype assignment.",
      "3. Call sites that reach this definition ⇒ `fp-novel`, stating which resolution step failed and why (or `fp-classifier-regression` when an in-scope rule's intent covers it). Every reference targets a same-named sibling and nothing else calls it ⇒ `tp`.",
    ].join("\n"),
  },
  "callers-in-registry-wrong-target": {
    title: "Wrong Resolution Target",
    summary:
      "Ariadne resolved call references matching this name, but to a different symbol: resolution linked the call to the wrong definition.",
    investigation_guide: [
      "1. For each call reference, compare its `resolved to` targets with this definition: same method name on another class, a shadowing local, an overload, an interface versus its implementation.",
      "2. Read the call site and decide which definition it actually reaches, from the receiver's type or the import it names.",
      "3. A call that reaches this definition but resolved elsewhere ⇒ `fp-novel` naming the mis-resolution (or `fp-classifier-regression` when an in-scope rule's intent covers it). The targets are correct and nothing else calls this definition ⇒ `tp`.",
    ].join("\n"),
  },
};

export function hints_for_diagnosis(diagnosis: string): DiagnosisHints {
  return DIAGNOSIS_HINTS[diagnosis] ?? GENERIC_HINTS;
}
