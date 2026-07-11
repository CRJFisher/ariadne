import { basename, dirname } from "path";

export function is_test_file_python(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  if (file_name.startsWith("test_") && file_name.endsWith(".py")) {
    return true;
  }

  if (file_name.endsWith("_test.py")) {
    return true;
  }

  if (file_name === "conftest.py") {
    return true;
  }

  if (dir_name.endsWith("/tests") || dir_name.includes("/tests/")) {
    return true;
  }

  if (dir_name.endsWith("/test") || dir_name.includes("/test/")) {
    return true;
  }

  return false;
}
