import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.json'],
  },
});