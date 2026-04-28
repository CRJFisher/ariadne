import path from "path";

export function path_within_project(candidate: string, root: string): boolean {
  const abs_root = path.resolve(root);
  const abs_candidate = path.resolve(abs_root, candidate);
  const rel = path.relative(abs_root, abs_candidate);
  if (rel === "") return true;
  if (path.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(".." + path.sep);
}
