import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";

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
      "import": importPlugin,
      "unused-imports": unusedImports
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true
      }
    },
    rules: {
      // TypeScript specific rules - disable base rule, use unused-imports plugin instead
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",

      // Auto-fixable unused imports detection
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",

      // Naming conventions: snake_case for everything except classes/interfaces/types (PascalCase)
      // NOTE: Set to "warn" due to 2000+ existing violations. Upgrade to "error" after cleanup.
      "@typescript-eslint/naming-convention": [
        "warn",
        // Default: snake_case for most identifiers
        {
          "selector": "default",
          "format": ["snake_case"],
          "leadingUnderscore": "allow"
        },
        // Variables: snake_case, but allow UPPER_CASE for const
        {
          "selector": "variable",
          "format": ["snake_case", "UPPER_CASE"],
          "leadingUnderscore": "allow"
        },
        // Destructured variables: allow any format (preserve original names from external APIs)
        {
          "selector": "variable",
          "modifiers": ["destructured"],
          "format": null
        },
        // Functions: snake_case
        {
          "selector": "function",
          "format": ["snake_case"]
        },
        // Parameters: snake_case, allow leading underscore for unused
        {
          "selector": "parameter",
          "format": ["snake_case"],
          "leadingUnderscore": "allow"
        },
        // Class/interface/typeAlias/enum: PascalCase
        {
          "selector": "typeLike",
          "format": ["PascalCase"]
        },
        // Enum members: UPPER_CASE (common convention)
        {
          "selector": "enumMember",
          "format": ["UPPER_CASE"]
        },
        // Imports: allow both (external libraries use various conventions)
        {
          "selector": "import",
          "format": null
        },
        // Properties that require quotes: ignore (e.g., "Content-Type")
        {
          "selector": "property",
          "modifiers": ["requiresQuotes"],
          "format": null
        },
        // Object literal properties: allow flexibility for external API compatibility
        {
          "selector": "objectLiteralProperty",
          "format": null
        }
      ],

      // General JavaScript rules
      "no-console": "off", // Allow console.log for now
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
        performance: "readonly",
        // Timer functions for async tests
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly"
      }
    },
    rules: {
      // Relax rules for test files
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "unused-imports/no-unused-imports": "off",
      "unused-imports/no-unused-vars": "off",
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
        document: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Reflect: "readonly"
      }
    },
    rules: {
      // Test fixtures intentionally have unused variables to simulate real code
      "unused-imports/no-unused-imports": "off",
      "unused-imports/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // Allow redeclarations in test fixtures (intentional for testing)
      "no-redeclare": "off",
      // Fixtures demonstrate language features including dynamic imports
      "no-restricted-syntax": "off",
      "import/first": "off",
      // Allow constant conditions in test fixtures (intentional for testing)
      "no-constant-condition": "off",
      // Allow undefined globals that are used for testing purposes
      "no-undef": "off"
    }
  },
  {
    files: ["entrypoint-analysis/**/*.ts"],
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
      "packages/*/node_modules/**",
      "**/tests/fixtures/**/*.js", // Ignore JavaScript fixture files
      "**/.claude/**", // Ignore Claude hook files
      "**/.clinic/**", // Ignore clinic profiler output
      "test_*.ts", // Ignore root-level test/debug scripts
      "debug_*.ts" // Ignore root-level debug scripts
    ]
  }
];
