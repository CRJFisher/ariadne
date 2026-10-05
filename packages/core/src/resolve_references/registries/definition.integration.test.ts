import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "../../project/project";

/**
 * The member index a project builds from real source in each language: every
 * name a receiver of the type can look up, keyed to the kind of definition that
 * holds it. An enum's variants are values of the enum, not members a receiver
 * dispatches to, so they never appear.
 */
describe("member index built from indexed source", () => {
  const temp_dirs: string[] = [];

  afterAll(() => {
    for (const dir of temp_dirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  /** Index `code` as `file_name` and return the member index of each named type, as name → definition kind. */
  async function member_kinds_of(
    file_name: string,
    code: string,
    type_names: readonly string[]
  ): Promise<Record<string, Record<string, string> | undefined>> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "member-index-")));
    temp_dirs.push(dir);
    const file = path.join(dir, file_name) as FilePath;
    fs.writeFileSync(file, code);
    const project = new Project();
    await project.initialize(dir as FilePath);
    project.update_file(file, code);

    const index = project.get_index_single_file(file)!;
    const declarations = [
      ...index.classes.values(),
      ...index.interfaces.values(),
      ...index.enums.values(),
    ];
    const result: Record<string, Record<string, string> | undefined> = {};
    for (const type_name of type_names) {
      const declaration = declarations.find((definition) => definition.name === type_name);
      if (!declaration) throw new Error(`${file_name} declares no ${type_name}`);
      const members = project.definitions.get_member_index().get(declaration.symbol_id);
      result[type_name] = members
        ? Object.fromEntries(
            [...members].map(([name, member_id]) => [name, project.definitions.get(member_id)!.kind])
          )
        : undefined;
    }
    return result;
  }

  describe("javascript", () => {
    it("holds a class's methods", async () => {
      expect(
        await member_kinds_of("a.js", `class User {
  getName() { return this.name; }
  getEmail() { return this.email; }
}
`, ["User"])
      ).toEqual({ User: { getName: "method", getEmail: "method" } });
    });

    it("holds the fields a constructor declares by assigning them", async () => {
      expect(
        await member_kinds_of("a.js", `class User {
  constructor() {
    this.name = "";
    this.email = "";
  }
}
`, ["User"])
      ).toEqual({ User: { constructor: "constructor", name: "property", email: "property" } });
    });

    it("keeps two classes' members apart", async () => {
      expect(
        await member_kinds_of("a.js", `class Dog { bark() {} }
class Cat { meow() {} }
`, ["Dog", "Cat"])
      ).toEqual({ Dog: { bark: "method" }, Cat: { meow: "method" } });
    });

    it("holds no entry for an empty class", async () => {
      expect(await member_kinds_of("a.js", "class Empty {}\n", ["Empty"])).toEqual({ Empty: undefined });
    });
  });

  describe("typescript", () => {
    it("holds a class's properties and methods", async () => {
      expect(
        await member_kinds_of("a.ts", `class User {
  name: string;
  email: string;
  getName(): string { return this.name; }
  getEmail(): string { return this.email; }
}
`, ["User"])
      ).toEqual({ User: { name: "property", email: "property", getName: "method", getEmail: "method" } });
    });

    it("holds an interface's property and method signatures", async () => {
      expect(
        await member_kinds_of("a.ts", `interface IUser {
  name: string;
  email: string;
  getName(): string;
  getEmail(): string;
}
`, ["IUser"])
      ).toEqual({ IUser: { name: "property", email: "property", getName: "method", getEmail: "method" } });
    });

    it("holds static and instance methods alike", async () => {
      expect(
        await member_kinds_of("a.ts", `class User {
  static create(): User { return new User(); }
  getName(): string { return ""; }
}
`, ["User"])
      ).toEqual({ User: { create: "method", getName: "method" } });
    });
  });

  describe("python", () => {
    it("holds a class's methods", async () => {
      expect(
        await member_kinds_of("a.py", `class User:
    def get_name(self) -> str:
        pass

    def get_email(self) -> str:
        pass
`, ["User"])
      ).toEqual({ User: { get_name: "method", get_email: "method" } });
    });

    it("holds an instance attribute assigned in __init__ beside the constructor", async () => {
      expect(
        await member_kinds_of("a.py", `class User:
    def __init__(self, name: str):
        self.name = name
`, ["User"])
      ).toEqual({ User: { __init__: "constructor", name: "property" } });
    });

    it("holds static and instance methods alike", async () => {
      expect(
        await member_kinds_of("a.py", `class User:
    @staticmethod
    def create():
        return User()

    def get_name(self):
        return ""
`, ["User"])
      ).toEqual({ User: { create: "method", get_name: "method" } });
    });

    it("holds a Protocol's method signatures", async () => {
      expect(
        await member_kinds_of("a.py", `from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None:
        ...
`, ["Drawable"])
      ).toEqual({ Drawable: { draw: "method" } });
    });
  });

  describe("rust", () => {
    it("holds a struct's impl-block methods", async () => {
      expect(
        await member_kinds_of("lib.rs", `struct User {}

impl User {
    fn new() -> User { User {} }
    fn get_name(&self) -> String { String::new() }
}
`, ["User"])
      ).toEqual({ User: { new: "method", get_name: "method" } });
    });

    it("holds a struct's fields beside its methods", async () => {
      expect(
        await member_kinds_of("lib.rs", `struct User {
    name: String,
    email: String,
}

impl User {
    fn new(name: String) -> User {
        User { name, email: String::new() }
    }
}
`, ["User"])
      ).toEqual({ User: { name: "property", email: "property", new: "method" } });
    });

    it("holds an enum's impl-block methods and none of its variants", async () => {
      expect(
        await member_kinds_of("lib.rs", `enum Outcome {
    Ok(i32),
    Err(String)
}

impl Outcome {
    fn is_ok(&self) -> bool { true }
    fn is_err(&self) -> bool { false }
}

enum Color {
    Red,
    Green,
    Blue
}
`, ["Outcome", "Color"])
      ).toEqual({ Outcome: { is_ok: "method", is_err: "method" }, Color: undefined });
    });
  });
});
