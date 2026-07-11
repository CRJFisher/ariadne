import { basename, dirname } from "path";

export function is_test_file_rust(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  if (file_name.endsWith("_test.rs")) {
    return true;
  }

  if (dir_name.endsWith("/tests") || dir_name.includes("/tests/")) {
    return true;
  }

  if (dir_name.endsWith("/benches") || dir_name.includes("/benches/")) {
    return true;
  }

  return false;
}
