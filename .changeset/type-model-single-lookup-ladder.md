---
"@ariadnejs/core": major
"@ariadnejs/types": major
---

Record the five type facts once and resolve members over a single lookup ladder.

A receiver-directed call needs five facts: what a name's annotation denotes,
what type a scope's `self` binds to, what a binding holds, what a type's full
member set is, and which types are its subtypes. Each is now recorded once in
the store that owns it, and member lookup reads those stores in one order
instead of re-deriving each fact at the point of use from raw source text.

The effect lands on the pipeline's product — the list of functions nothing
calls. Measured over ten corpora, a control arm and a candidate arm interleaved
in one session on one box:

| Corpus               | Raw entry points        | Resolved calls                               |
| -------------------- | ----------------------- | -------------------------------------------- |
| angular/angular      | 4,276 → 3,096 (−28%)    | 148,316 → 160,166                            |
| microsoft/TypeScript | 1,201 → 758 (−37%)      | 91,141 → 93,358                              |
| rust-lang/rust       | see "Two figures" below | 78,734 → 113,204 (+44%)                      |
| django/django        | 2,494 → 2,289           | `constructor_target_not_a_class` 15,021 → 63 |
| pandas-dev/pandas    | 2,298 → 2,085           | that reason → 0                              |
| celery/celery        | 800 → 730               | that reason → 0                              |

## What resolves that did not

- **Annotations are parsed before they are resolved.** An annotation used to
  resolve only when its source text was byte-identical to a declared name.
  Rust `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>` and `impl Emit`,
  TypeScript `F | null`, Python `Optional[C]`, `Union[C, None]` and `"C"`, and
  JSDoc `{ChunkGraph=}`, `{ChunkGraph|null}` and `{import("./a").X}` now all
  denote the type they name, through `parse_type_annotation` and its four
  per-language parsers.
- **A scope knows its own `self` type.** `LexicalScope.self_type_name` records
  it, so a getter/setter pair, a constructor-only class, a constructor body and
  a cross-file Rust `impl` block all answer `self`. On rust-lang/rust,
  `no_enclosing_class_scope` falls 27,173 → 2,567.
- **A binding answers what it holds.** Class aliases, factory return values and
  element reads now type their receiver, which is what clears
  `constructor_target_not_a_class` on the Python corpora.
- **A type's member set is complete.** Members are unioned across every file
  that contributes them, so a Rust type reached from a submodule `impl` block
  carries the methods that block declares, and enums carry theirs.
- **The subtype graph is single-sourced.** Qualified TypeScript heritage, dotted
  Python bases, Rust trait edges, structural conformance for interfaces no class
  declares, and every base past the first all produce edges. A member miss fans
  out over the subtype closure, and a `super` call dispatches up the method
  resolution order to the member that runs rather than fanning down.

Every call-kind reference now ends as either a resolved call or a recorded
`ResolutionFailure` carrying the reason it failed, and the
`resolved + failed == call references` invariant is asserted in the resolver.

## Two figures that are not comparable term by term

- **Call reference counts fall on the Python corpora.** A heuristic constructor
  capture recorded every argument-bearing Python call a second time; deleting it
  drops 93,143 call references on pandas and 53,468 on django. Nothing was lost
  — the second record was never a distinct call.
- **Raw entry points rise on the Rust corpora.** Methods declared in cross-file
  `impl` blocks are definitions the graph holds for the first time, so tokio
  gains 994 nodes, sqlx 848 and rustc 9,951. A method nothing calls is an entry
  point. Restricted to the nodes both trees hold, the genuinely new entry points
  are two on tokio, one on sqlx and fifty-six on rustc.

## Known residue

Four shapes are out of scope and will not resolve: an `exports.update()` call on
a `WebAssembly.Instance` exports object, DI containers keyed by computed runtime
tokens, a `.on_error(...)` call off an unannotated Python factory, and Rust
`Drop`, whose destructor call is compiler-injected with no call expression in
source. They are recorded as permanent limitations rather than targets.

## Types

`@ariadnejs/types` bumps in lockstep (linked release). Added:
`ResolutionFailure` and its per-reason union, `AriadneFaultArea` with the
reason-to-area mapping, and `LexicalScope.self_type_name`. `parent_types` is
multi-valued. The single `symbol_types` map is split into value types and
callable return types. `TypeMemberInfo` is removed along with the three member
builders that fed it.

Cached per-file indexes are keyed on an indexer-build fingerprint, so this
release's bump retires every blob written by the previous indexer and re-indexes
each file once.
