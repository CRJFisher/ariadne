import * as vfs from "./barrel";

export function load(fs: vfs.FileSystem | null): string {
  if (!fs) {
    return "";
  }
  return fs.read_file("config.json");
}

export function load_inline(fs: import("./barrel").FileSystem): string {
  return fs.read_file("inline.json");
}
