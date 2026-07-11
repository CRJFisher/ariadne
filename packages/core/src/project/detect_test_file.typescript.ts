import { basename, dirname } from "path";

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
