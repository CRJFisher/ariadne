import { describe, test, expect, beforeEach } from "vitest";
import { Def, Project, Ref } from "../src/index";

describe("JavaScript - Advanced Language-Specific Features", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test("JSX elements", () => {
    const code = `import React from 'react';
const element = <div className="test">Hello</div>;
const component = <MyComponent prop={value} />;`;

    const fileName = "test.jsx";
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);

    const defs = graph!.getNodes<Def>("definition");
    expect(defs.find((d) => d.name === "element")).toBeDefined();
    expect(defs.find((d) => d.name === "component")).toBeDefined();
  });

  test("Private class fields", () => {
    const code = `class MyClass {
  #privateField = 42;
  #privateMethod() {
    return this.#privateField;
  }
  
  getPrivate() {
    return this.#privateMethod();
  }
}`;

    const fileName = "test.js";
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);

    const defs = graph!.getNodes<Def>("definition");
    expect(defs.find((d) => d.name === "MyClass")).toBeDefined();
    expect(defs.find((d) => d.name === "#privateField")).toBeDefined();
    expect(defs.find((d) => d.name === "#privateMethod")).toBeDefined();
    expect(defs.find((d) => d.name === "getPrivate")).toBeDefined();
  });

  test("Complex closures and scope capturing", () => {
    const code = `function outer(x) {
  let captured = x;
  
  function middle(y) {
    let local = y;
    
    return function inner(z) {
      return captured + local + z;
    };
  }
  
  return middle;
}

const fn = outer(1)(2);
const result = fn(3);`;

    const fileName = "test.js";
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);

    const defs = graph!.getNodes<Def>("definition");
    expect(defs.find((d) => d.name === "outer")).toBeDefined();
    expect(defs.find((d) => d.name === "middle")).toBeDefined();
    expect(defs.find((d) => d.name === "inner")).toBeDefined();
    expect(defs.find((d) => d.name === "captured")).toBeDefined();
    expect(defs.find((d) => d.name === "local")).toBeDefined();
  });

  test("Loop labels and break/continue", () => {
    const code = `outer: for (let i = 0; i < 10; i++) {
  inner: for (let j = 0; j < 10; j++) {
    if (i + j === 5) {
      break outer;
    }
    if (j === 3) {
      continue inner;
    }
  }
}`;

    const fileName = "test.js";
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);

    const defs = graph!.getNodes<Def>("definition");
    expect(defs.find((d) => d.name === "i")).toBeDefined();
    expect(defs.find((d) => d.name === "j")).toBeDefined();

    // Check label references
    const refs = graph!.getNodes<Ref>("reference");
    expect(refs.find((r) => r.name === "outer")).toBeDefined();
    expect(refs.find((r) => r.name === "inner")).toBeDefined();
  });

  test("for...in and for...of loops", () => {
    const code = `const obj = { a: 1, b: 2, c: 3 };
const arr = [1, 2, 3];

for (const key in obj) {
  console.log(key, obj[key]);
}

for (const value of arr) {
  console.log(value);
}

for (const [index, value] of arr.entries()) {
  console.log(index, value);
}`;

    const fileName = "test.js";
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);

    const defs = graph!.getNodes<Def>("definition");
    // Should find loop variables
    const keyDefs = defs.filter((d) => d.name === "key");
    const valueDefs = defs.filter((d) => d.name === "value");
    const indexDefs = defs.filter((d) => d.name === "index");

    expect(keyDefs.length).toBeGreaterThan(0);
    expect(valueDefs.length).toBeGreaterThan(0);
    expect(indexDefs.length).toBeGreaterThan(0);
  });

  test("Complex destructuring patterns", () => {
    const code = `const {
  a: { b: { c: deepValue } },
  d: [first, , third],
  e: renamed,
  f = 'default',
  ...rest
} = complexObject;

const [
  [x, y],
  { z },
  ...remaining
] = complexArray;`;

    const fileName = "test.js";
    project.add_or_update_file(fileName, code);
    const graph = project.get_scope_graph(fileName);

    const defs = graph!.getNodes<Def>("definition");
    expect(defs.find((d) => d.name === "deepValue")).toBeDefined();
    expect(defs.find((d) => d.name === "first")).toBeDefined();
    expect(defs.find((d) => d.name === "third")).toBeDefined();
    expect(defs.find((d) => d.name === "renamed")).toBeDefined();
    expect(defs.find((d) => d.name === "rest")).toBeDefined();
    expect(defs.find((d) => d.name === "x")).toBeDefined();
    expect(defs.find((d) => d.name === "y")).toBeDefined();
    expect(defs.find((d) => d.name === "z")).toBeDefined();
    expect(defs.find((d) => d.name === "remaining")).toBeDefined();
  });
});
