/**
 * The streaming rewriter exists because the store's largest artifacts cannot be
 * read into a string, so the cases that matter are the ones a whole-file
 * `String.replace` would get for free and a chunked scanner can lose: a needle
 * straddling a chunk boundary, a needle whose replacement contains the needle,
 * and two needles competing for the same position.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  stream_copy_with_replacements,
  stream_replace_in_place,
} from "./stream_rewrite.js";

describe("stream_rewrite", () => {
  let tmp_dir: string;
  let source_path: string;
  let dest_path: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "stream-rewrite-"));
    source_path = path.join(tmp_dir, "source.json");
    dest_path = path.join(tmp_dir, "dest.json");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  async function write_source(text: string): Promise<void> {
    await fs.writeFile(source_path, text, "utf8");
  }

  async function read_dest(): Promise<string> {
    return fs.readFile(dest_path, "utf8");
  }

  it("substitutes every occurrence and counts them by needle", async () => {
    await write_source("{\"a\":\"/old/x\",\"b\":\"/old/y\"}");

    const counts = await stream_copy_with_replacements(source_path, dest_path, [
      { find: "/old", replace: "/new" },
    ]);

    expect(await read_dest()).toEqual("{\"a\":\"/new/x\",\"b\":\"/new/y\"}");
    expect(counts).toEqual({ "/old": 2 });
  });

  it("copies verbatim when no replacement is given", async () => {
    await write_source("{\"a\":\"/old/x\"}");

    const counts = await stream_copy_with_replacements(source_path, dest_path, []);

    expect(await read_dest()).toEqual("{\"a\":\"/old/x\"}");
    expect(counts).toEqual({});
  });

  it("reports zero occurrences as an absent key rather than a zero", async () => {
    await write_source("{\"a\":\"/kept\"}");

    const counts = await stream_copy_with_replacements(source_path, dest_path, [
      { find: "/old", replace: "/new" },
    ]);

    expect(await read_dest()).toEqual("{\"a\":\"/kept\"}");
    expect(counts).toEqual({});
  });

  it("matches a needle straddling a chunk boundary", async () => {
    // The chunk size is 1 MiB; pad so "/Users/chuck" spans the boundary.
    const needle = "/Users/chuck";
    const chunk_bytes = 1024 * 1024;
    const prefix = "x".repeat(chunk_bytes - 5);
    await write_source(`${prefix}${needle}/tail`);

    const counts = await stream_copy_with_replacements(source_path, dest_path, [
      { find: needle, replace: "/Users/dana" },
    ]);

    expect(await read_dest()).toEqual(`${prefix}/Users/dana/tail`);
    expect(counts).toEqual({ [needle]: 1 });
  });

  it("matches a needle spanning three chunks", async () => {
    const chunk_bytes = 1024 * 1024;
    const needle = "n".repeat(2 * chunk_bytes + 7);
    await write_source(`head${needle}tail`);

    await expect(
      stream_copy_with_replacements(source_path, dest_path, [
        { find: needle, replace: "short" },
      ]),
    ).rejects.toThrow(/exceeds the 1048576-byte chunk size/);
  });

  it("does not rescan replacement text for the needle it replaced", async () => {
    await write_source("aa");

    const counts = await stream_copy_with_replacements(source_path, dest_path, [
      { find: "a", replace: "aa" },
    ]);

    expect(await read_dest()).toEqual("aaaa");
    expect(counts).toEqual({ a: 2 });
  });

  it("takes the leftmost match when two needles compete", async () => {
    await write_source("__project_name__");

    const counts = await stream_copy_with_replacements(source_path, dest_path, [
      { find: "project_name", replace: "PN" },
      { find: "_project", replace: "XP" },
    ]);

    expect(await read_dest()).toEqual("_XP_name__");
    expect(counts).toEqual({ _project: 1 });
  });

  it("rejects an empty needle rather than looping on it", async () => {
    await write_source("anything");

    await expect(
      stream_copy_with_replacements(source_path, dest_path, [{ find: "", replace: "x" }]),
    ).rejects.toThrow("stream_rewrite: a replacement's `find` must be non-empty");
  });

  it("replaces in place and leaves no temp file behind", async () => {
    await write_source("{\"project_name\": \"legacy\"}");

    const counts = await stream_replace_in_place(source_path, [
      { find: "\"project_name\": \"legacy\"", replace: "\"project_name\": \"owner--repo\"" },
    ]);

    expect(await fs.readFile(source_path, "utf8")).toEqual(
      "{\"project_name\": \"owner--repo\"}",
    );
    expect(counts).toEqual({ "\"project_name\": \"legacy\"": 1 });
    expect(await fs.readdir(tmp_dir)).toEqual(["source.json"]);
  });

  it("leaves the original intact when an in-place rewrite fails", async () => {
    await write_source("{\"project_name\": \"legacy\"}");

    await expect(
      stream_replace_in_place(source_path, [{ find: "", replace: "x" }]),
    ).rejects.toThrow();

    expect(await fs.readFile(source_path, "utf8")).toEqual("{\"project_name\": \"legacy\"}");
    expect(await fs.readdir(tmp_dir)).toEqual(["source.json"]);
  });
});
