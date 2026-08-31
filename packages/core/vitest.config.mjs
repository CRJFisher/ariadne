import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    maxWorkers: 1,
    // On this box a loaded run pushes sub-second tests past vitest's 5 s default
    // (TASK-381.8 measured the suite green at 60 s), so the default states the
    // same bound the load-heavy describes already carry.
    testTimeout: 30_000,
    setupFiles: './tests/setup.ts',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/',
        'scripts/',
      ],
    },
  },
});