import { basename, dirname } from "path";

import { is_in_test_dir } from "./test_dir_patterns";

export function is_test_file_typescript(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  if (file_name.endsWith(".test.ts") || file_name.endsWith(".test.tsx")) {
    return true;
  }

  if (file_name.endsWith(".spec.ts") || file_name.endsWith(".spec.tsx")) {
    return true;
  }

  if (file_name.endsWith(".e2e.ts") || file_name.endsWith(".e2e.tsx")) {
    return true;
  }

  if (file_name.endsWith(".e2e-spec.ts")) {
    return true;
  }

  if (file_name.endsWith(".integration.ts") || file_name.endsWith(".integration.tsx")) {
    return true;
  }

  if (is_in_test_dir(dir_name)) {
    return true;
  }

  return false;
}
