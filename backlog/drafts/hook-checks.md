# Hook Checks

- Make sure no files have been left in a 'backwards compatible' state, routing the imports so the old imports still work.
  - Could check for (non index.ts) files that only have import/exports, no actual code.
