import { describe, it, expect } from "vitest";

import type {
  EnrichedEntryPoint,
  FilePath,
  GrepHit,
  ReferenceSiteDiagnostic,
  Language,
} from "@ariadnejs/types";
import { check_dispatch_table_value_registration } from "./check_dispatch-table-value-registration";

const CALLER_FILE = "/repo/src/dispatch.py" as FilePath;
const EMPTY_READER = (_: string) => [] as readonly string[];

function reference_site(content: string): ReferenceSiteDiagnostic {
  return {
    file_path: "src/x.py" as FilePath,
    line: 1,
    content,
    reference_kind: "property_access",
    access_type: "property",
    receiver_kind: "self",
  };
}

function grep_hit(content: string): GrepHit {
  return { file_path: CALLER_FILE, line: 1, content, captures: [] };
}

function make_entry(overrides: {
  name?: string;
  file_path?: FilePath;
  grep_lines?: string[];
} = {}): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "handler",
    file_path: overrides.file_path ?? CALLER_FILE,
    start_line: 10,
    kind: "method",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_outside_index: [],
      reference_sites: (overrides.grep_lines ?? []).map(reference_site),
      ariadne_call_refs: [],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
    },
  };
}

function run(entry: EnrichedEntryPoint, language: Language): boolean {
  return check_dispatch_table_value_registration(entry, EMPTY_READER, language);
}

describe("check_dispatch_table_value_registration", () => {
  it("matches a method registered as an int-keyed dict value (celery task_protocols)", () => {
    const entry = make_entry({
      name: "as_task_v1",
      grep_lines: ["self.task_protocols = {1: self.as_task_v1, 2: self.as_task_v2}"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a method registered as a string-keyed dict value (celery commands)", () => {
    const entry = make_entry({
      name: "expand",
      grep_lines: ["self.commands = {'expand': self.expand, 'show': self.show}"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a callback registered as a dict value with a foreign receiver (dumper.on_event)", () => {
    const entry = make_entry({
      name: "on_event",
      grep_lines: ["recv = app.events.Receiver(conn, handlers={'*': dumper.on_event})"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a keymap dict value later fetched via .get(key) (celery cursor)", () => {
    const entry = make_entry({
      name: "revoke_selection",
      grep_lines: ["self.keymap = {'C': self.revoke_selection, 'K': self.move_selection_up}"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a constructor registered as an enum-keyed dict value (sqlalchemy direction processors)", () => {
    const entry = make_entry({
      name: "_OneToManyDP",
      grep_lines: [
        "_direction_to_processor = { ONETOMANY: _OneToManyDP, MANYTOONE: _ManyToOneDP, MANYTOMANY: _ManyToManyDP }",
      ],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a method registered as a list element (pandas subheader processors)", () => {
    const entry = make_entry({
      name: "_process_rowsize_subheader",
      grep_lines: [
        "self._subheader_processors = [\n    self._process_rowsize_subheader,\n    self._process_columnsize_subheader,\n]",
      ],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a callback registered as a tuple element (celery regex handler table)", () => {
    const entry = make_entry({
      name: "_star_steps",
      grep_lines: ["    (re.compile(self._star + self._steps), self._star_steps),"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a single-element list registration fetched by numeric index (sqlalchemy baked steps)", () => {
    const entry = make_entry({
      name: "_retrieve_baked_query",
      grep_lines: ["self.steps = [_spoil_point._retrieve_baked_query]"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a lambda-wrapped dict value invoking the entry (pytorch NNAPI ADDER_MAP)", () => {
    const entry = make_entry({
      name: "add_conv2d",
      grep_lines: ["        \"aten::conv2d\": lambda self, node: self.add_conv2d(node),"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a lambda value that passes extra args to the entry (add_qconv2d)", () => {
    const entry = make_entry({
      name: "add_qconv2d",
      grep_lines: [
        "        \"quantized::conv2d\": lambda self, node: self.add_qconv2d(node, NNAPI_FuseCode.FUSED_NONE),",
      ],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a JS object-literal value registration", () => {
    const entry = make_entry({
      name: "onData",
      file_path: "/repo/src/net.js" as FilePath,
      grep_lines: ["const handlers = { data: this.onData, close: this.onClose };"],
    });
    expect(run(entry, "javascript")).toBe(true);
  });

  it("does not match a same-named identifier quoted as ordinary string data", () => {
    const entry = make_entry({
      name: "on_event",
      grep_lines: ["config = { 'callback': 'on_event', 'level': 3 }"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a longer identifier that merely starts with the name", () => {
    const entry = make_entry({
      name: "handle_failure",
      grep_lines: ["metrics = { retries: handle_failure_count, total: n }"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match the same name used in an arithmetic expression (not a value slot)", () => {
    const entry = make_entry({
      name: "_steps",
      grep_lines: ["pattern = re.compile(self._star + self._steps)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match the computed-index invocation line owned by dynamic-property-keyed-callback", () => {
    const entry = make_entry({
      name: "expand",
      grep_lines: ["return self.commands[command](*argv) or EX_OK"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a getattr dispatch line owned by dynamic-property-keyed-callback", () => {
    const entry = make_entry({
      name: "add_conv2d",
      grep_lines: ["handler_method = getattr(self, f\"method_{name}\")"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match the TypeScript computed-index dispatch owned by string-keyed-dispatch", () => {
    const entry = make_entry({
      name: "visitEachChildOfConditionalExpression",
      file_path: "/repo/src/visit.ts" as FilePath,
      grep_lines: [
        "const fn = (visitEachChildTable as Record<SyntaxKind, VisitEachChildFunction<any> | undefined>)[node.kind]; return fn(node, visitor);",
      ],
    });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match a non-supported language (rust)", () => {
    const entry = make_entry({
      name: "as_task_v1",
      grep_lines: ["self.task_protocols = {1: self.as_task_v1}"],
    });
    expect(run(entry, "rust")).toBe(false);
  });
});
