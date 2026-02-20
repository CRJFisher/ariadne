import { describe, it, expect } from "vitest";
import { is_test_file } from "./detect_test_file";
import type { Language } from "@ariadnejs/types";

describe("is_test_file", () => {
  describe("TypeScript", () => {
    const language: Language = "typescript";

    describe("file suffix patterns", () => {
      it("detects *.test.ts files", () => {
        expect(is_test_file("/src/utils.test.ts", language)).toBe(true);
        expect(is_test_file("/src/deep/nested/module.test.ts", language)).toBe(true);
      });

      it("detects *.test.tsx files", () => {
        expect(is_test_file("/src/Component.test.tsx", language)).toBe(true);
      });

      it("detects *.spec.ts files", () => {
        expect(is_test_file("/src/utils.spec.ts", language)).toBe(true);
      });

      it("detects *.spec.tsx files", () => {
        expect(is_test_file("/src/Component.spec.tsx", language)).toBe(true);
      });

      it("detects *.e2e.ts files (end-to-end tests)", () => {
        expect(is_test_file("/src/app.e2e.ts", language)).toBe(true);
        expect(is_test_file("/e2e/login.e2e.ts", language)).toBe(true);
      });

      it("detects *.e2e.tsx files (end-to-end tests)", () => {
        expect(is_test_file("/src/Component.e2e.tsx", language)).toBe(true);
      });

      it("detects *.e2e-spec.ts files (Angular e2e)", () => {
        expect(is_test_file("/e2e/app.e2e-spec.ts", language)).toBe(true);
        expect(is_test_file("/src/login.e2e-spec.ts", language)).toBe(true);
      });

      it("detects *.integration.ts files", () => {
        expect(is_test_file("/src/api.integration.ts", language)).toBe(true);
        expect(is_test_file("/src/database.integration.ts", language)).toBe(true);
      });

      it("detects *.integration.tsx files", () => {
        expect(is_test_file("/src/Form.integration.tsx", language)).toBe(true);
      });
    });

    describe("directory patterns", () => {
      it("detects files in __tests__ directory", () => {
        expect(is_test_file("/src/__tests__/utils.ts", language)).toBe(true);
        expect(is_test_file("/src/__tests__/nested/module.ts", language)).toBe(true);
      });

      it("detects files in tests directory (plural)", () => {
        expect(is_test_file("/tests/utils.ts", language)).toBe(true);
        expect(is_test_file("/src/tests/module.ts", language)).toBe(true);
        expect(is_test_file("/project/tests/nested/file.ts", language)).toBe(true);
      });

      it("detects files in test directory (singular)", () => {
        expect(is_test_file("/test/utils.ts", language)).toBe(true);
        expect(is_test_file("/src/test/module.ts", language)).toBe(true);
        expect(is_test_file("/project/test/nested/file.ts", language)).toBe(true);
      });
    });

    describe("negative cases", () => {
      it("does not detect regular source files", () => {
        expect(is_test_file("/src/utils.ts", language)).toBe(false);
        expect(is_test_file("/src/Component.tsx", language)).toBe(false);
        expect(is_test_file("/src/testing.ts", language)).toBe(false);
      });

      it("does not detect files with test-like names that are not tests", () => {
        expect(is_test_file("/src/test_helpers.ts", language)).toBe(false);
        expect(is_test_file("/src/testing_utils.ts", language)).toBe(false);
      });
    });
  });

  describe("JavaScript", () => {
    const language: Language = "javascript";

    describe("file suffix patterns", () => {
      it("detects *.test.js files", () => {
        expect(is_test_file("/src/utils.test.js", language)).toBe(true);
      });

      it("detects *.test.jsx files", () => {
        expect(is_test_file("/src/Component.test.jsx", language)).toBe(true);
      });

      it("detects *.spec.js files", () => {
        expect(is_test_file("/src/utils.spec.js", language)).toBe(true);
      });

      it("detects *.spec.jsx files", () => {
        expect(is_test_file("/src/Component.spec.jsx", language)).toBe(true);
      });

      it("detects *.e2e.js files (end-to-end tests)", () => {
        expect(is_test_file("/src/app.e2e.js", language)).toBe(true);
        expect(is_test_file("/e2e/login.e2e.js", language)).toBe(true);
      });

      it("detects *.e2e.jsx files (end-to-end tests)", () => {
        expect(is_test_file("/src/Component.e2e.jsx", language)).toBe(true);
      });

      it("detects *.e2e-spec.js files (Angular e2e)", () => {
        expect(is_test_file("/e2e/app.e2e-spec.js", language)).toBe(true);
      });

      it("detects *.integration.js files", () => {
        expect(is_test_file("/src/api.integration.js", language)).toBe(true);
      });

      it("detects *.integration.jsx files", () => {
        expect(is_test_file("/src/Form.integration.jsx", language)).toBe(true);
      });
    });

    describe("directory patterns", () => {
      it("detects files in __tests__ directory", () => {
        expect(is_test_file("/src/__tests__/utils.js", language)).toBe(true);
      });

      it("detects files in tests directory (plural)", () => {
        expect(is_test_file("/tests/utils.js", language)).toBe(true);
        expect(is_test_file("/src/tests/module.js", language)).toBe(true);
      });

      it("detects files in test directory (singular)", () => {
        expect(is_test_file("/test/utils.js", language)).toBe(true);
        expect(is_test_file("/src/test/module.js", language)).toBe(true);
      });
    });

    describe("negative cases", () => {
      it("does not detect regular source files", () => {
        expect(is_test_file("/src/utils.js", language)).toBe(false);
        expect(is_test_file("/src/Component.jsx", language)).toBe(false);
      });
    });
  });

  describe("Python", () => {
    const language: Language = "python";

    describe("file naming patterns", () => {
      it("detects test_*.py files", () => {
        expect(is_test_file("/src/test_utils.py", language)).toBe(true);
        expect(is_test_file("/src/test_module.py", language)).toBe(true);
      });

      it("detects *_test.py files", () => {
        expect(is_test_file("/src/utils_test.py", language)).toBe(true);
        expect(is_test_file("/src/module_test.py", language)).toBe(true);
      });

      it("detects conftest.py files", () => {
        expect(is_test_file("/src/conftest.py", language)).toBe(true);
        expect(is_test_file("/tests/conftest.py", language)).toBe(true);
      });
    });

    describe("directory patterns", () => {
      it("detects files in tests directory (plural)", () => {
        expect(is_test_file("/tests/test_utils.py", language)).toBe(true);
        expect(is_test_file("/src/tests/module.py", language)).toBe(true);
        expect(is_test_file("/project/tests/nested/file.py", language)).toBe(true);
      });

      it("detects files in test directory (singular)", () => {
        expect(is_test_file("/test/test_utils.py", language)).toBe(true);
        expect(is_test_file("/src/test/module.py", language)).toBe(true);
        expect(is_test_file("/project/test/nested/file.py", language)).toBe(true);
      });
    });

    describe("negative cases", () => {
      it("does not detect regular source files", () => {
        expect(is_test_file("/src/utils.py", language)).toBe(false);
        expect(is_test_file("/src/testing_utils.py", language)).toBe(false);
      });

      it("does not detect files that contain 'test' but don't match patterns", () => {
        expect(is_test_file("/src/test_helpers_factory.py", language)).toBe(true); // This matches test_*.py
        expect(is_test_file("/src/contest.py", language)).toBe(false);
        expect(is_test_file("/src/attest.py", language)).toBe(false);
      });
    });
  });

  describe("Rust", () => {
    const language: Language = "rust";

    describe("file naming patterns", () => {
      it("detects *_test.rs files", () => {
        expect(is_test_file("/src/utils_test.rs", language)).toBe(true);
        expect(is_test_file("/src/module_test.rs", language)).toBe(true);
      });
    });

    describe("directory patterns", () => {
      it("detects files in tests directory", () => {
        expect(is_test_file("/tests/integration.rs", language)).toBe(true);
        expect(is_test_file("/project/tests/e2e.rs", language)).toBe(true);
        expect(is_test_file("/tests/nested/module.rs", language)).toBe(true);
      });

      it("detects files in benches directory (benchmarks)", () => {
        expect(is_test_file("/benches/perf.rs", language)).toBe(true);
        expect(is_test_file("/project/benches/benchmark.rs", language)).toBe(true);
        expect(is_test_file("/benches/nested/bench.rs", language)).toBe(true);
      });
    });

    describe("negative cases", () => {
      it("does not detect regular source files", () => {
        expect(is_test_file("/src/lib.rs", language)).toBe(false);
        expect(is_test_file("/src/main.rs", language)).toBe(false);
        expect(is_test_file("/src/testing.rs", language)).toBe(false);
      });

      it("does not detect files with test in name that don't match patterns", () => {
        expect(is_test_file("/src/test_utils.rs", language)).toBe(false);
        expect(is_test_file("/src/contest.rs", language)).toBe(false);
      });
    });
  });
});
