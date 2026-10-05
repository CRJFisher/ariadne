import { describe, it, expect } from "vitest";
import { build_signature } from "./build_signature";
import type { AnyDefinition, SymbolName, ScopeId } from "@ariadnejs/types";

const name = (s: string) => s as SymbolName;
const scope = (s: string) => s as ScopeId;

describe("build_signature", () => {
  it("builds signature for function definition", () => {
    const def = {
      kind: "function",
      name: name("process_data"),
      is_exported: false,
      body_scope_id: scope("s1"),
      signature: {
        parameters: [
          { name: "input", type: "string" },
          { name: "count", type: "number" },
        ],
        return_type: "boolean",
      },
    } as object as AnyDefinition;

    expect(build_signature(def)).toBe("process_data(input: string, count: number): boolean");
  });

  it("builds signature for method definition", () => {
    const def = {
      kind: "method",
      name: name("get_value"),
      access_modifier: "public",
      static: false,
      parameters: [{ name: "key", type: "string" }],
      return_type: "any",
    } as object as AnyDefinition;

    expect(build_signature(def)).toBe("get_value(key: string): any");
  });

  it("builds signature for constructor definition", () => {
    const def = {
      kind: "constructor",
      name: name("constructor"),
      parameters: [{ name: "config", type: "Config" }],
    } as object as AnyDefinition;

    expect(build_signature(def)).toBe("constructor(config: Config)");
  });

  it("handles function with no parameters", () => {
    const def = {
      kind: "function",
      name: name("init"),
      is_exported: true,
      body_scope_id: scope("s1"),
      signature: { parameters: [], return_type: "void" },
    } as object as AnyDefinition;

    expect(build_signature(def)).toBe("init(): void");
  });

  it("uses 'any' for parameters without type annotation", () => {
    const def = {
      kind: "function",
      name: name("loose"),
      is_exported: false,
      body_scope_id: scope("s1"),
      signature: { parameters: [{ name: "x" }], return_type: "string" },
    } as object as AnyDefinition;

    expect(build_signature(def)).toBe("loose(x: any): string");
  });

  it("renders an anonymous function with its location so listings stay distinguishable", () => {
    const def = {
      kind: "function",
      name: name("<anonymous>"),
      is_exported: false,
      body_scope_id: scope("s1"),
      signature: { parameters: [], return_type: "void" },
    } as object as AnyDefinition;

    expect(build_signature(def, { file_path: "src/utils.ts", start_line: 42 })).toBe(
      "<anonymous@utils.ts:42>(): void",
    );
  });

  it("leaves the anonymous name bare when no location is supplied", () => {
    const def = {
      kind: "function",
      name: name("<anonymous>"),
      is_exported: false,
      body_scope_id: scope("s1"),
      signature: { parameters: [], return_type: "void" },
    } as object as AnyDefinition;

    expect(build_signature(def)).toBe("<anonymous>(): void");
  });
});
