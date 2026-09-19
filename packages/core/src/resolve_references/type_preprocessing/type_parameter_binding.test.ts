import { describe, it, expect } from "vitest";
import type { ScopeId, SymbolName, TypeParameter } from "@ariadnejs/types";
import { parse_type_annotation, type ParsedTypeAnnotation } from "./annotation";
import {
  bind_type_parameter_bounds,
  substitute_type_parameters,
  unify_type_parameters,
  type ConcreteType,
  type TypeParameterBinding,
} from "./type_parameter_binding";

const CALL_SCOPE = "scope:caller" as ScopeId;
const DECLARATION_SCOPE = "scope:declaration" as ScopeId;

function annotation(text: string): ParsedTypeAnnotation {
  const parsed = parse_type_annotation(text, "typescript");
  if (parsed === null) {
    throw new Error(`${text} does not parse as one named type`);
  }
  return parsed;
}

function value(text: string): ConcreteType {
  return { kind: "value", annotation: annotation(text) };
}

function class_object(text: string): ConcreteType {
  return { kind: "class_object", annotation: annotation(text) };
}

/** Every binding `declared` takes from `concrete`, as annotation text. */
function bind(
  declared: string,
  concrete: ConcreteType,
  type_parameters: readonly string[]
): Record<string, string> {
  const bindings = new Map<SymbolName, TypeParameterBinding>();
  unify_type_parameters(
    annotation(declared),
    concrete,
    new Set(type_parameters as SymbolName[]),
    CALL_SCOPE,
    bindings
  );
  return bound_names(bindings);
}

function bound_names(bindings: ReadonlyMap<SymbolName, TypeParameterBinding>): Record<string, string> {
  return Object.fromEntries(
    [...bindings].map(([name, binding]) => [name, binding.annotation.head.join(".")])
  );
}

describe("unify_type_parameters", () => {
  it("binds a type token's parameter to the type its argument names", () => {
    expect(bind("Type<T>", class_object("Foo"), ["T"])).toEqual({ T: "Foo" });
  });

  it("binds every parameter a keyed container declares, argument for argument", () => {
    expect(bind("Map<K, V>", value("Map<string, Foo>"), ["K", "V"])).toEqual({
      K: "string",
      V: "Foo",
    });
  });

  it("binds a parameter nested inside an argument", () => {
    expect(bind("Wrapper<Inner<T>>", value("Wrapper<Inner<Baz>>"), ["T"])).toEqual({ T: "Baz" });
  });

  it("binds a bare parameter to the whole annotation the argument declares", () => {
    expect(bind("T", value("Collector"), ["T"])).toEqual({ T: "Collector" });
  });

  it("binds a token parameter through the declared token an argument already carries", () => {
    expect(bind("Type<T>", value("Type<Service>"), ["T"])).toEqual({ T: "Service" });
  });

  it("binds nothing from a wrapper handed a value rather than a type", () => {
    expect(bind("Type<T>", value("Foo"), ["T"])).toEqual({});
  });

  it("binds nothing from a class object handed to a bare parameter", () => {
    expect(bind("T", class_object("Foo"), ["T"])).toEqual({});
  });

  it("binds nothing from a container, which holds values of its parameter rather than naming it", () => {
    expect(bind("Array<T>", class_object("Foo"), ["T"])).toEqual({});
    expect(bind("T[]", class_object("Foo"), ["T"])).toEqual({});
  });

  it("binds nothing when the two annotations name different types", () => {
    expect(bind("Map<K, V>", value("Registry<string, Foo>"), ["K", "V"])).toEqual({});
  });

  it("binds nothing when the arities disagree", () => {
    expect(bind("Map<K, V>", value("Map<Foo>"), ["K", "V"])).toEqual({});
  });

  it("binds nothing for a name the declaration does not declare as a parameter", () => {
    expect(bind("Type<T>", class_object("Foo"), ["U"])).toEqual({});
  });

  it("keeps the first binding of a parameter two arguments both speak to", () => {
    const bindings = new Map<SymbolName, TypeParameterBinding>();
    const type_parameters = new Set(["T"] as SymbolName[]);
    unify_type_parameters(annotation("Type<T>"), class_object("First"), type_parameters, CALL_SCOPE, bindings);
    unify_type_parameters(annotation("Type<T>"), class_object("Second"), type_parameters, CALL_SCOPE, bindings);

    expect(bound_names(bindings)).toEqual({ T: "First" });
  });

  it("carries the scope a binding is to be resolved in", () => {
    const bindings = new Map<SymbolName, TypeParameterBinding>();
    unify_type_parameters(
      annotation("Type<T>"),
      class_object("Foo"),
      new Set(["T"] as SymbolName[]),
      CALL_SCOPE,
      bindings
    );

    expect(bindings.get("T" as SymbolName)?.scope_id).toEqual(CALL_SCOPE);
  });
});

describe("bind_type_parameter_bounds", () => {
  const parameters: readonly TypeParameter[] = [
    { name: "V" as SymbolName, bound: "Visitor" as SymbolName },
    { name: "U" as SymbolName },
  ];

  it("binds a bounded parameter to its bound, in the declaration's own scope", () => {
    const bindings = new Map<SymbolName, TypeParameterBinding>();
    bind_type_parameter_bounds(parameters, DECLARATION_SCOPE, bindings);

    expect(bound_names(bindings)).toEqual({ V: "Visitor" });
    expect(bindings.get("V" as SymbolName)?.scope_id).toEqual(DECLARATION_SCOPE);
  });

  it("leaves a parameter a call site already bound alone", () => {
    const bindings = new Map<SymbolName, TypeParameterBinding>([
      ["V" as SymbolName, { annotation: annotation("Collector"), scope_id: CALL_SCOPE }],
    ]);
    bind_type_parameter_bounds(parameters, DECLARATION_SCOPE, bindings);

    expect(bound_names(bindings)).toEqual({ V: "Collector" });
  });
});

describe("substitute_type_parameters", () => {
  const type_parameters = new Set(["T"] as SymbolName[]);
  const environment = new Map<SymbolName, TypeParameterBinding>([
    ["T" as SymbolName, { annotation: annotation("Foo"), scope_id: CALL_SCOPE }],
  ]);

  it("resolves a return written as the parameter itself", () => {
    const substituted = substitute_type_parameters(annotation("T"), type_parameters, environment);

    expect(substituted?.annotation).toEqual(annotation("Foo"));
    expect(substituted?.scope_id).toEqual(CALL_SCOPE);
  });

  it("substitutes a parameter standing inside a return's arguments", () => {
    const substituted = substitute_type_parameters(
      annotation("Wrapper<T>"),
      type_parameters,
      environment
    );

    expect(substituted?.annotation).toEqual(annotation("Wrapper<Foo>"));
  });

  it("answers nothing for a parameter the environment leaves unbound", () => {
    expect(
      substitute_type_parameters(annotation("U"), new Set(["U"] as SymbolName[]), environment)
    ).toBeNull();
  });

  it("answers nothing for a return naming no parameter at all", () => {
    expect(substitute_type_parameters(annotation("Foo"), type_parameters, environment)).toBeNull();
  });
});
