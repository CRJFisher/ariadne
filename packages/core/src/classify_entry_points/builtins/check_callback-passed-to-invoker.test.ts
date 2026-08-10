import { describe, it, expect } from "vitest";

import type {
  EnrichedEntryPoint,
  FilePath,
  GrepHit,
  Language,
} from "@ariadnejs/types";
import { check_callback_passed_to_invoker } from "./check_callback-passed-to-invoker";

const CALLER_FILE = "/repo/src/dispatch.ts" as FilePath;
const EMPTY_READER = (_: string) => [] as readonly string[];

function grep_hit(content: string): GrepHit {
  return { file_path: CALLER_FILE, line: 1, content, captures: [] };
}

function make_entry(
  overrides: {
    name?: string;
    file_path?: FilePath;
    grep_lines?: string[];
  } = {},
): EnrichedEntryPoint {
  return {
    name: overrides.name ?? "on_node_status",
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
      grep_call_sites: (overrides.grep_lines ?? []).map(grep_hit),
      grep_call_sites_outside_index: [],
      reference_sites: [],
      ariadne_call_refs: [],
      diagnosis: "callers-in-registry-unresolved",
      has_uncaptured_indexed_grep_hit: false,
    },
  };
}

function run(entry: EnrichedEntryPoint, language: Language): boolean {
  return check_callback_passed_to_invoker(entry, EMPTY_READER, language);
}

describe("check_callback_passed_to_invoker", () => {
  it("matches a bound method passed by reference to a maybe_call invoker (python)", () => {
    const entry = make_entry({
      name: "on_send_signal",
      grep_lines: ["maybe_call(self.on_send_signal, node, signal_name(sig))"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a bound method passed as a trailing positional callback arg (python)", () => {
    const entry = make_entry({
      name: "on_node_status",
      grep_lines: ["maybe_call(self.on_node_status, node, retcode)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a bound method passed as a keyword-argument callback (python)", () => {
    const entry = make_entry({
      name: "on_node_shutdown_ok",
      grep_lines: ["Cluster(nodes, on_node_shutdown_ok=self.on_node_shutdown_ok)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a bound attribute reference handed to a higher-order helper (python)", () => {
    const entry = make_entry({
      name: "_access_cls",
      grep_lines: ["self._dict = util.PopulateDict(self._access_cls)"],
    });
    expect(run(entry, "python")).toBe(true);
  });

  it("matches a .bind(this)-wrapped method passed to an event invoker (javascript)", () => {
    const entry = make_entry({
      name: "onData",
      grep_lines: ["this.socket.on('data', this.onData.bind(this));"],
    });
    expect(run(entry, "javascript")).toBe(true);
  });

  it("matches the same .bind(this) callback in typescript", () => {
    const entry = make_entry({
      name: "onData",
      grep_lines: ["this.socket.on('data', this.onData.bind(this));"],
    });
    expect(run(entry, "typescript")).toBe(true);
  });

  it("does not match a callback passed on a NAMED receiver, which is statically resolvable", () => {
    const entry = make_entry({
      name: "highlightHydrationNodes",
      grep_lines: ["messageBus.on('createHydrationOverlay', inspector.highlightHydrationNodes);"],
    });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match a bare-name argument, which is indistinguishable from passing a data value", () => {
    const entry = make_entry({
      name: "updateEventInfoForA11yClick",
      grep_lines: ["actionResolver.addA11yClickSupport(updateEventInfoForA11yClick, opts);"],
    });
    expect(run(entry, "typescript")).toBe(false);
  });

  it("does not match a direct call on self, which the resolver can bind", () => {
    const entry = make_entry({
      name: "on_node_status",
      grep_lines: ["maybe_call(self.on_node_status(), node, retcode)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a further member access on the bound reference", () => {
    const entry = make_entry({
      name: "on_node_status",
      grep_lines: ["logger.info(self.on_node_status.__name__)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match a computed-index dispatch, which belongs to dynamic-property-keyed-callback", () => {
    const entry = make_entry({
      name: "on_node_status",
      grep_lines: ["handler = self.on_node_status[key]; handler(node)"],
    });
    expect(run(entry, "python")).toBe(false);
  });

  it("does not match an unsupported language", () => {
    const entry = make_entry({
      name: "on_node_status",
      grep_lines: ["maybe_call(self.on_node_status, node, retcode)"],
    });
    expect(run(entry, "rust")).toBe(false);
  });
});
