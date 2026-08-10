import { basename, dirname } from "path";

import { is_in_test_dir } from "./test_dir_patterns";

export function is_test_file_rust(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  if (file_name.endsWith("_test.rs")) {
    return true;
  }

  // Cargo's benchmark tree is a test tree for candidacy: a bench harness calls
  // production code without being production code itself.
  if (dir_name.endsWith("/benches") || dir_name.includes("/benches/")) {
    return true;
  }

  return is_in_test_dir(dir_name);
}
