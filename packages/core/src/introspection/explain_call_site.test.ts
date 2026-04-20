import { describe, it, expect, beforeEach } from "vitest";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import { Project } from "../project/project";
import { explain_call_site, type ExplainCallSiteResult } from "./explain_call_site";

describe("explain_call_site", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  it("returns capture_fired=true and the resolved definition for a same-file function call", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `function greet() { return "hi"; }
greet();
`
    );

    const call_line = find_call_line(project, file, "greet" as SymbolName);
    const result = explain_call_site(project, file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.resolution_failure).toBeUndefined();
    expect(result.import_trace).toBeUndefined();
    expect(result.candidate_definitions.length).toBe(1);
    expect(result.candidate_definitions[0].name).toBe("greet");
    expect(result.candidate_definitions[0].kind).toBe("function");
  });

  it("returns resolution_failure with reason=name_not_in_scope for an unknown function", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `undefined_fn();
`
    );

    const call_line = find_call_line(project, file, "undefined_fn" as SymbolName);
    const result = explain_call_site(project, file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.candidate_definitions).toEqual([]);
    expect(result.resolution_failure).toBeDefined();
    expect(result.resolution_failure?.reason).toBe("name_not_in_scope");
  });

  it("returns receiver_kind=identifier and a resolution_failure for a method call on an untyped parameter", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `function use(x) { x.do_thing(); }
`
    );

    const call_line = find_call_line(project, file, "do_thing" as SymbolName);
    const result = explain_call_site(project, file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.receiver_kind).toBe("identifier");
    expect(result.candidate_definitions).toEqual([]);
    expect(result.resolution_failure).toBeDefined();
    expect(result.resolution_failure?.reason).toBe("receiver_type_unknown");
  });

  it("returns capture_fired=false for a line with no call syntax", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `const x = 1;
function greet() { return "hi"; }
greet();
`
    );

    const result = explain_call_site(project, file, 0);

    const expected: ExplainCallSiteResult = {
      capture_fired: false,
      candidate_definitions: [],
    };
    expect(result).toEqual(expected);
  });

  it("populates import_trace when a call resolves to a cross-file definition", () => {
    const utils_file = "utils.ts" as FilePath;
    const main_file = "main.ts" as FilePath;
    project.update_file(utils_file, "export function helper() { return 1; }\n");
    project.update_file(
      main_file,
      `import { helper } from "./utils";
helper();
`
    );

    const call_line = find_call_line(project, main_file, "helper" as SymbolName);
    const result = explain_call_site(project, main_file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.resolution_failure).toBeUndefined();
    expect(result.candidate_definitions.length).toBe(1);
    expect(result.candidate_definitions[0].name).toBe("helper");
    expect(result.import_trace).toBeDefined();
    expect(result.import_trace).toEqual([utils_file]);
  });

  it("disambiguates multiple calls on the same line via the column argument", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `function one() { return 1; }
function two() { return 2; }
one(); two();
`
    );

    const calls = project.resolutions.get_calls_for_file(file);
    const one_call = calls.find((c) => c.name === ("one" as SymbolName));
    const two_call = calls.find((c) => c.name === ("two" as SymbolName));
    expect(one_call).toBeDefined();
    expect(two_call).toBeDefined();

    const result_one = explain_call_site(
      project,
      file,
      one_call!.location.start_line,
      one_call!.location.start_column
    );
    const result_two = explain_call_site(
      project,
      file,
      two_call!.location.start_line,
      two_call!.location.start_column
    );

    expect(result_one.candidate_definitions[0].name).toBe("one");
    expect(result_two.candidate_definitions[0].name).toBe("two");
  });

  it("picks the leftmost call on a line when no column is supplied", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `function one() { return 1; }
function two() { return 2; }
one(); two();
`
    );

    const calls = project.resolutions.get_calls_for_file(file);
    const one_call = calls.find((c) => c.name === ("one" as SymbolName))!;
    const two_call = calls.find((c) => c.name === ("two" as SymbolName))!;
    // Column-less lookup must always return the leftmost — independent of
    // the resolver's internal insertion order.
    expect(one_call.location.start_column).toBeLessThan(two_call.location.start_column);

    const line = one_call.location.start_line;
    const result = explain_call_site(project, file, line);
    expect(result.candidate_definitions.length).toBe(1);
    expect(result.candidate_definitions[0].name).toBe("one");
  });

  it("returns receiver_kind=self_keyword for a `this.m()` call inside a class method", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `class A {
  run() { this.helper(); }
  helper() { return 1; }
}
`
    );

    const call_line = find_call_line(project, file, "helper" as SymbolName);
    const result = explain_call_site(project, file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.receiver_kind).toBe("self_keyword");
    expect(result.resolution_failure).toBeUndefined();
    expect(result.candidate_definitions.length).toBe(1);
    expect(result.candidate_definitions[0].name).toBe("helper");
    expect(result.candidate_definitions[0].kind).toBe("method");
  });

  it("returns receiver_kind=member_expression for a nested-member receiver `a.b.m()`", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `class Inner { run() { return 1; } }
class Outer { inner = new Inner(); }
const o = new Outer();
o.inner.run();
`
    );

    const call_line = find_call_line(project, file, "run" as SymbolName);
    const result = explain_call_site(project, file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.receiver_kind).toBe("member_expression");
  });

  it("returns resolution_failure with reason=method_not_on_type for a method that does not exist on a typed receiver", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `class C { m() { return 1; } }
const c = new C();
c.nonexistent();
`
    );

    const call_line = find_call_line(project, file, "nonexistent" as SymbolName);
    const result = explain_call_site(project, file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.candidate_definitions).toEqual([]);
    expect(result.resolution_failure).toBeDefined();
    expect(result.resolution_failure?.reason).toBe("method_not_on_type");
  });

  it("surfaces multiple candidates for a polymorphic method call on an interface", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `interface Handler { run(): number; }
class A implements Handler { run() { return 1; } }
class B implements Handler { run() { return 2; } }
function dispatch(h: Handler) { h.run(); }
`
    );

    const call_line = find_call_line(project, file, "run" as SymbolName);
    const result = explain_call_site(project, file, call_line);

    expect(result.capture_fired).toBe(true);
    expect(result.receiver_kind).toBe("identifier");
    expect(result.candidate_definitions.length).toBeGreaterThanOrEqual(2);
    const names = result.candidate_definitions.map((d) => d.name).sort();
    for (const name of names) expect(name).toBe("run");
  });

  it("captures constructor calls without a receiver_kind", () => {
    const file = "main.ts" as FilePath;
    project.update_file(
      file,
      `class C { constructor() {} }
new C();
`
    );

    const calls = project.resolutions.get_calls_for_file(file);
    const ctor_call = calls.find((c) => c.call_type === "constructor");
    expect(ctor_call).toBeDefined();

    const result = explain_call_site(
      project,
      file,
      ctor_call!.location.start_line,
      ctor_call!.location.start_column
    );

    expect(result.capture_fired).toBe(true);
    // Constructor calls deliberately carry no call_site_syntax, so
    // receiver_kind must be absent — that absence is the fact.
    expect(result.receiver_kind).toBeUndefined();
    expect(result.candidate_definitions.length).toBeGreaterThan(0);
  });
});

function find_call_line(
  project: Project,
  file: FilePath,
  name: SymbolName
): number {
  const calls = project.resolutions.get_calls_for_file(file);
  const match = calls.find((c) => c.name === name);
  if (!match) {
    throw new Error(
      `No call to "${name}" found in ${file}. Calls: ${calls.map((c) => c.name).join(", ")}`
    );
  }
  return match.location.start_line;
}
