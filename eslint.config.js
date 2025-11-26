import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "import": importPlugin
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true
      }
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // General JavaScript rules
      "no-console": "off", // Allow console.log for now
      "no-unused-vars": "off", // Use TypeScript version instead
      "prefer-const": "error",
      "no-var": "error",

      // Code style
      "indent": "off", // Let formatter handle indentation
      "quotes": ["error", "double"],
      "semi": ["error", "always"],

      // Import rules
      "import/first": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "Dynamic imports (import()) are not allowed. Use static imports: import { x } from \"module\""
        },
        {
          selector: "TSAsExpression[typeAnnotation.typeName.name='any']",
          message: "'as any' type assertions are not allowed. Use proper typing or a more specific assertion."
        },
        {
          selector: "TSAsExpression > TSAnyKeyword",
          message: "'as any' type assertions are not allowed. Use proper typing or a more specific assertion."
        }
      ]
    }
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: {
        // Vitest/Jest globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
        vi: "readonly",
        jest: "readonly",
        // Performance monitoring in tests
        performance: "readonly"
      }
    },
    rules: {
      // Relax rules for test files
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-console": "off",
      // Allow 'as any' in tests, but still prohibit dynamic imports
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "Dynamic imports (import()) are not allowed. Use static imports: import { x } from \"module\""
        }
      ]
    }
  },
  {
    files: ["**/tests/fixtures/**/*.ts", "**/test/**/*.ts"],
    languageOptions: {
      globals: {
        // Browser/Node globals for test fixtures
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        performance: "readonly",
        window: "readonly",
        document: "readonly"
      }
    },
    rules: {
      // Test fixtures intentionally have unused variables to simulate real code
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Allow redeclarations in test fixtures (intentional for testing)
      "no-redeclare": "off",
      // Fixtures demonstrate language features including dynamic imports
      "no-restricted-syntax": "off",
      "import/first": "off"
    }
  },
  {
    files: ["top-level-nodes-analysis/**/*.ts"],
    languageOptions: {
      globals: {
        // Node.js globals for analysis scripts
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly"
      }
    }
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.js", // Ignore JS files in root
      "packages/*/dist/**",
      "packages/*/node_modules/**"
    ]
  }
];
