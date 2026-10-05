// Classifier for the known-issues registry rule `registration-decorator-dispatch`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A Python function is ENROLLED into a runtime dispatch table by a REGISTRATION
// DECORATOR on its definition, then invoked later via a computed key — e.g.
// `lowerings[op](...)`, `op_implementations_dict[func](...)`, `self.fns[backend](...)`.
// The only source line bearing the function's name is the decorated definition;
// the dispatch site resolves the callee dynamically, so no static call edge links
// caller to definition and the function looks unreachable.
//
// The discriminant is the registration decorator itself, read from the lines
// immediately above the definition. Keying on this curated decorator set — rather
// than on the dynamic dispatch site — keeps the predicate precise: an ordinary
// decorator (`@staticmethod`, `@lru_cache`, `@property`, `@dataclass`,
// `@pytest.fixture`) does NOT enroll into a dispatch table and must not match.
//
// The registration-decorator set is evidence-driven (PyTorch inductor lowerings,
// PyTorch fake-tensor / functorch op impls, Celery control commands, SQLAlchemy
// dialect `for_db` / `event.listens_for` / test-suite `post` hooks):
//
//   - `register_*` family — `@register_lowering(...)`, `@register_op_impl(...)`,
//     `@register_comm_lowering(...)`: a bare (optionally dotted) decorator whose
//     callable name starts with `register_`.
//   - enrollment-method decorators — `@<obj>.for_db(...)`, `@<obj>.py_impl(...)`,
//     `@<obj>.py_functionalize_impl(...)`: a method call on a per-symbol registrar
//     object that stores the function under a backend / dispatch-mode key.
//   - named singleton registrars — `@event.listens_for(...)`, `@control_command(...)`.
//   - bare `@post` — the SQLAlchemy test-suite `post_configure` registrar. Matched
//     ONLY without a receiver prefix, so HTTP route shortcuts (`@app.post(...)`,
//     `@router.post(...)`) — a distinct routing-dispatch limitation — do not match.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { extract_decorator_block } from "./extract_decorator_block";

// A decorator line enrolling the definition into a runtime dispatch table.
// Two shapes: an optionally-dotted registrar name (`register_*`, enrollment
// methods, named singletons), or the bare `@post` registrar (no receiver prefix).
const REGISTRATION_DECORATOR = new RegExp(
  "^\\s*@(?:" +
    "(?:[A-Za-z_][\\w]*\\.)*" +
    "(?:register_[A-Za-z_]\\w*|for_db|py_impl|py_functionalize_impl|listens_for|control_command)" +
    "|post" +
    ")\\b",
  "m",
);

export function check_registration_decorator_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  if (language !== "python") return false;

  const decorator_block = extract_decorator_block(
    read_file_lines(entry_point.file_path),
    entry_point.start_line,
  );

  return REGISTRATION_DECORATOR.test(decorator_block);
}
