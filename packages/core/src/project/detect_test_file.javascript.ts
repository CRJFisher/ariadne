import { basename, dirname } from "path";

import { is_in_test_dir } from "./test_dir_patterns";

export function is_test_file_javascript(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  if (file_name.endsWith(".test.js") || file_name.endsWith(".test.jsx")) {
    return true;
  }

  if (file_name.endsWith(".spec.js") || file_name.endsWith(".spec.jsx")) {
    return true;
  }

  if (file_name.endsWith(".e2e.js") || file_name.endsWith(".e2e.jsx")) {
    return true;
  }

  if (file_name.endsWith(".e2e-spec.js")) {
    return true;
  }

  if (file_name.endsWith(".integration.js") || file_name.endsWith(".integration.jsx")) {
    return true;
  }

  if (is_in_test_dir(dir_name)) {
    return true;
  }

  return false;
}
