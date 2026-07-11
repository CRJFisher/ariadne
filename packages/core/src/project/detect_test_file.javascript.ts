import { basename, dirname } from "path";

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

  if (dir_name.endsWith("__tests__") || dir_name.includes("__tests__/")) {
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
