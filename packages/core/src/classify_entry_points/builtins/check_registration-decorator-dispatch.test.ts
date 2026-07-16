import { describe, it, expect } from "vitest";

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { check_registration_decorator_dispatch } from "./check_registration-decorator-dispatch";

const EMPTY_READER = (_: string) => [] as readonly string[];

function make_entry(overrides: {
  name?: string;
  file_path?: FilePath;
  start_line?: number;
} = {}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "tuned_mm",
    file_path: overrides.file_path ?? ("/repo/torch/_inductor/lowering.py" as FilePath),
    start_line: overrides.start_line ?? 10,
    kind: "function",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    },
  };
}

// A reader whose `start_line` (1-based) definition is preceded by `decorators`.
function reader_with_decorators(
  start_line: number,
  decorators: string[],
): (path: string) => readonly string[] {
  const lines: string[] = [];
  for (let i = 0; i < start_line - 1 - decorators.length; i++) lines.push("");
  for (const d of decorators) lines.push(d);
  lines.push("def _body():");
  return (_: string) => lines;
}

function run(entry: EnrichedEntryPoint, reader: (path: string) => readonly string[]): boolean {
  return check_registration_decorator_dispatch(entry, reader, "python");
}

describe("check_registration_decorator_dispatch", () => {
  // PyTorch inductor: @register_lowering(...) enrolls into the `lowerings` dict,
  // invoked via lowerings[op](*args) — entry_index 7954, 7978, 7981, 7984.
  it("matches @register_lowering enrolling a lowering into the dispatch dict", () => {
    const entry = make_entry({ name: "tuned_scaled_grouped_mm", start_line: 40 });
    const reader = reader_with_decorators(40, ["@register_lowering(aten._scaled_grouped_mm.default, type_promotion_kind=None)"]);
    expect(run(entry, reader)).toBe(true);
  });

  it("matches a bare @register_lowering without a receiver prefix", () => {
    const entry = make_entry({ name: "median_default", start_line: 12 });
    const reader = reader_with_decorators(12, ["@register_lowering(aten.median.default, type_promotion_kind=None)"]);
    expect(run(entry, reader)).toBe(true);
  });

  // PyTorch fake-tensor: @register_op_impl(...) enrolls into op_implementations_dict,
  // dispatched via op_implementations_dict[func](...) — entry_index 8023.
  it("matches @register_op_impl enrolling an op implementation", () => {
    const entry = make_entry({ name: "_view_meta_copy", file_path: "/repo/torch/_subclasses/fake_impls.py" as FilePath, start_line: 15 });
    const reader = reader_with_decorators(15, ["@register_op_impl(aten.view_copy.default)"]);
    expect(run(entry, reader)).toBe(true);
  });

  // PyTorch distributed: @register_comm_lowering(...) — entry_index 8030.
  it("matches @register_comm_lowering", () => {
    const entry = make_entry({ name: "_all_reduce_", start_line: 15 });
    const reader = reader_with_decorators(15, ["@register_comm_lowering(c10d.all_reduce_)"]);
    expect(run(entry, reader)).toBe(true);
  });

  // SQLAlchemy dialect registrar: @<obj>.for_db("backend") stores the function in
  // self.fns[backend], dispatched via self.fns[backend](...) — entry_index 2908, 2917, 2918, 2916.
  it("matches an @<obj>.for_db(...) enrollment-method decorator", () => {
    const entry = make_entry({ name: "_upsert", file_path: "/repo/lib/sqlalchemy/dialects/sqlite/provision.py" as FilePath, start_line: 22 });
    const reader = reader_with_decorators(22, ["@upsert.for_db(\"sqlite\")"]);
    expect(run(entry, reader)).toBe(true);
  });

  // PyTorch: @<obj>.py_impl(...) — entry_index 7909.
  it("matches an @<obj>.py_impl(...) dispatch-mode enrollment", () => {
    const entry = make_entry({ name: "flex_attention_backward_proxy_torch_dispatch_mode", start_line: 30 });
    const reader = reader_with_decorators(30, ["@flex_attention_backward.py_impl(ProxyTorchDispatchMode)"]);
    expect(run(entry, reader)).toBe(true);
  });

  // PyTorch: @<obj>.py_functionalize_impl (no call args) — entry_index 8026.
  it("matches an @<obj>.py_functionalize_impl decorator with no call arguments", () => {
    const entry = make_entry({ name: "invoke_leaf_function_functionalization", start_line: 18 });
    const reader = reader_with_decorators(18, ["@invoke_leaf_function.py_functionalize_impl"]);
    expect(run(entry, reader)).toBe(true);
  });

  // SQLAlchemy events: @event.listens_for(...) — entry_index 2913.
  it("matches @event.listens_for(...)", () => {
    const entry = make_entry({ name: "_column_added_to_pk_constraint", start_line: 15 });
    const reader = reader_with_decorators(15, ["@event.listens_for(PrimaryKeyConstraint, \"_sa_event_column_added_to_pk_constraint\")"]);
    expect(run(entry, reader)).toBe(true);
  });

  // Celery: @control_command(...) enrolls into the Panel registry — entry_index 1081.
  it("matches @control_command(...)", () => {
    const entry = make_entry({ name: "pool_grow", file_path: "/repo/celery/worker/control.py" as FilePath, start_line: 20 });
    const reader = reader_with_decorators(20, ["@control_command(args=[('n', int)], signature='[N=1]')"]);
    expect(run(entry, reader)).toBe(true);
  });

  // SQLAlchemy test harness: a bare @post registrar appends to post_configure,
  // invoked via `for fn in post_configure: fn(...)` — entry_index 2739, 2760.
  it("matches a bare @post registrar decorator", () => {
    const entry = make_entry({ name: "_prep_testing_database", file_path: "/repo/lib/sqlalchemy/testing/plugin/plugin_base.py" as FilePath, start_line: 12 });
    const reader = reader_with_decorators(12, ["@post"]);
    expect(run(entry, reader)).toBe(true);
  });

  it("matches @register_lowering stacked below an unrelated decorator", () => {
    const entry = make_entry({ name: "var_", start_line: 20 });
    const reader = reader_with_decorators(20, ["@staticmethod", "@register_lowering([aten.var, prims.var])"]);
    expect(run(entry, reader)).toBe(true);
  });

  it("does not match an ordinary @staticmethod-only decorated function", () => {
    const entry = make_entry({ name: "helper", start_line: 20 });
    const reader = reader_with_decorators(20, ["@staticmethod"]);
    expect(run(entry, reader)).toBe(false);
  });

  it("does not match @lru_cache", () => {
    const entry = make_entry({ name: "compute", start_line: 20 });
    const reader = reader_with_decorators(20, ["@lru_cache(maxsize=None)"]);
    expect(run(entry, reader)).toBe(false);
  });

  it("does not match @property", () => {
    const entry = make_entry({ name: "value", start_line: 20 });
    const reader = reader_with_decorators(20, ["@property"]);
    expect(run(entry, reader)).toBe(false);
  });

  it("does not match @pytest.fixture (owned by framework-pytest-fixture)", () => {
    const entry = make_entry({ name: "db_session", start_line: 20 });
    const reader = reader_with_decorators(20, ["@pytest.fixture"]);
    expect(run(entry, reader)).toBe(false);
  });

  // @app.post / @router.post are HTTP route shortcuts — a routing-dispatch
  // limitation, not enrollment into a computed-key table. The bare-only `post`
  // branch must not stretch to a dotted receiver.
  it("does not match an @app.post(...) HTTP route shortcut", () => {
    const entry = make_entry({ name: "create_item", start_line: 20 });
    const reader = reader_with_decorators(20, ["@app.post(\"/items\")"]);
    expect(run(entry, reader)).toBe(false);
  });

  it("does not match a similarly-named @post_configure decorator", () => {
    const entry = make_entry({ name: "handler", start_line: 20 });
    const reader = reader_with_decorators(20, ["@post_configure"]);
    expect(run(entry, reader)).toBe(false);
  });

  it("does not match a function carrying no decorator", () => {
    const entry = make_entry({ name: "plain", start_line: 20 });
    const reader = reader_with_decorators(20, []);
    expect(run(entry, reader)).toBe(false);
  });

  it("does not match a registration decorator on a non-python entry", () => {
    const entry = make_entry({ name: "tuned_mm", start_line: 20 });
    const reader = reader_with_decorators(20, ["@register_lowering(aten.mm)"]);
    expect(check_registration_decorator_dispatch(entry, reader, "typescript")).toBe(false);
  });
});
