import { describe, it, expect } from "vitest";
import { classify_accessor_line } from "./derive_definition_features.jsts";

describe("classify_accessor_line", () => {
  it("identifies a getter from a class accessor", () => {
    expect(classify_accessor_line("  get x() {")).toBe("getter");
  });

  it("identifies a setter from a class accessor", () => {
    expect(classify_accessor_line("  set value(v: number) {")).toBe("setter");
  });

  it("returns null for a regular method whose name starts with get", () => {
    expect(classify_accessor_line("  getThing() {")).toBeNull();
  });

  it("returns null for a regular method whose name starts with set", () => {
    expect(classify_accessor_line("  setThing(x) {")).toBeNull();
  });

  it("recognises modifiers preceding the accessor keyword", () => {
    expect(classify_accessor_line("  public static get x() {")).toBe("getter");
    expect(classify_accessor_line("  private set foo(v) {")).toBe("setter");
  });

  it("returns null for object-literal property assignments", () => {
    expect(classify_accessor_line("  get: 1,")).toBeNull();
    expect(classify_accessor_line("  set: 2,")).toBeNull();
  });

  it("returns null for plain function declarations", () => {
    expect(classify_accessor_line("function foo() {")).toBeNull();
  });
});
