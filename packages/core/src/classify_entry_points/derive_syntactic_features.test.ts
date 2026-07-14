import { describe, it, expect } from "vitest";
import { derive_syntactic_features } from "./derive_syntactic_features";
import type {
  CallReference,
  Location,
  SymbolName,
  ScopeId,
  FilePath,
  SyntacticFeatures,
} from "@ariadnejs/types";

const name = (s: string) => s as SymbolName;
const scope = (s: string) => s as ScopeId;
const fp = (s: string) => s as FilePath;

function make_location(line: number): Location {
  return {
    file_path: fp("src/test.ts"),
    start_line: line,
    start_column: 0,
    end_line: line,
    end_column: 1,
  };
}

function make_call_ref(overrides: Partial<CallReference> = {}): CallReference {
  return {
    location: make_location(10),
    name: name("callee"),
    scope_id: scope("s1"),
    call_type: "function",
    resolutions: [],
    is_callback_invocation: false,
    ...overrides,
  };
}

const NEUTRAL: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_inside_try: false,
  is_dynamic_dispatch: false,
};

describe("derive_syntactic_features", () => {
  it("flags a constructor call as a new-expression", () => {
    const out = derive_syntactic_features(
      make_call_ref({ call_type: "constructor" }),
      "const x = new Foo();",
    );
    expect(out).toEqual({ ...NEUTRAL, is_new_expression: true });
  });

  it("flags a super call from the call-site text", () => {
    const out = derive_syntactic_features(make_call_ref(), "super.render();");
    expect(out).toEqual({ ...NEUTRAL, is_super_call: true });
  });

  it("flags optional chaining and await together", () => {
    const out = derive_syntactic_features(make_call_ref(), "const r = await obj?.load();");
    expect(out).toEqual({ ...NEUTRAL, is_optional_chain: true, is_awaited: true });
  });

  it("flags a callback invocation from the call reference", () => {
    const out = derive_syntactic_features(
      make_call_ref({ is_callback_invocation: true }),
      "items.forEach(fn);",
    );
    expect(out).toEqual({ ...NEUTRAL, is_callback_arg: true });
  });

  it("flags dynamic dispatch when the receiver is a non-literal index access", () => {
    const out = derive_syntactic_features(
      make_call_ref({
        call_site_syntax: { receiver_kind: "index_access", index_key_is_literal: false },
      }),
      "handlers[key]();",
    );
    expect(out).toEqual({ ...NEUTRAL, is_dynamic_dispatch: true });
  });

  it("does not flag dynamic dispatch when the index key is a literal", () => {
    const out = derive_syntactic_features(
      make_call_ref({
        call_site_syntax: { receiver_kind: "index_access", index_key_is_literal: true },
      }),
      "handlers['fixed']();",
    );
    expect(out).toEqual(NEUTRAL);
  });

  it("leaves every flag false for a plain call", () => {
    const out = derive_syntactic_features(make_call_ref(), "plain_call(a, b);");
    expect(out).toEqual(NEUTRAL);
  });
});
