# Test Migration Example

This document shows how to migrate existing language tests to use the shared testing infrastructure.

## Before (Old Pattern)

```typescript
// src/languages/typescript/typescript.test.ts
import { test_scopes, ScopeDebug } from '../../test_utils';

test('simple', () => {
  const source = `
    import React from 'react';
    type SearchHistoryType = {
      text: string;
    };
  `;

  const expected: ScopeDebug = {
    definitions: [
      {
        name: 'SearchHistoryType',
        kind: 'alias',
        context: 'type §SearchHistoryType§ = {',
        referenced_in: [],
      },
    ],
    imports: [
      {
        name: 'React',
        context: 'import §React§ from \'react\';',
        referenced_in: [],
      },
    ],
    // ... lots of manual verification
  };

  test_scopes('TypeScript', source, expected);
});
```

## After (New Pattern)

### Step 1: Extract Common Features

Move tests for common features (imports, type definitions, etc.) to shared fixtures:

```typescript
// src/test/shared-language-tests.ts
export const SHARED_TEST_FIXTURES: LanguageTestFixture[] = [
  {
    name: 'Import Statements',
    languages: {
      typescript: {
        name: 'ES6 default and named imports',
        code: `import React, { useState } from 'react';
const component = React.createElement('div');`
      },
      // ... other languages
    },
    expectations: {
      definitions: [
        { name: 'React', kind: 'import' },
        { name: 'useState', kind: 'import' }
      ],
      references: [
        { name: 'React', fromLine: 1, count: 1 }
      ]
    }
  }
];
```

### Step 2: Create Language-Specific Test File

```typescript
// src/test/typescript-shared.test.ts
import { generateLanguageTests, runLanguageSpecificTests } from './shared-language-tests';

// This generates all the common tests automatically!
generateLanguageTests('typescript', () => 'ts');

// Only need to write TypeScript-specific tests
const typeScriptSpecificTests = [
  {
    name: 'Type Aliases',
    code: `type Point = { x: number; y: number };
const p: Point = { x: 1, y: 2 };`,
    test: (project, fileName) => {
      const graph = project.get_scope_graph(fileName);
      const defs = graph!.getNodes('definition');
      
      const pointType = defs.find(d => d.name === 'Point');
      expect(pointType!.symbol_kind).toBe('type');
    }
  }
];

runLanguageSpecificTests('TypeScript', typeScriptSpecificTests, () => 'ts');
```

## Benefits of Migration

### 1. Less Code Duplication

Before:
- Each language had its own test for imports (~50 lines each)
- Total: 200+ lines for 4 languages

After:
- One shared fixture definition (~20 lines)
- Automatically tested in all languages

### 2. Easier to Maintain

Before:
- Update import test in 4 different files when syntax changes
- Easy to miss a language

After:
- Update once in shared fixtures
- All languages get the update

### 3. Better Coverage

The shared infrastructure ensures:
- All languages test the same features
- Missing features are immediately visible
- Consistent test quality

### 4. Clearer Feature Support

The language feature matrix shows exactly what's supported:
- ✅ Supported and tested
- ❌ Not supported
- No ambiguity

## Migration Checklist

- [ ] Identify common patterns in existing tests
- [ ] Add patterns to `SHARED_TEST_FIXTURES`
- [ ] Create new test file using `generateLanguageTests()`
- [ ] Move language-specific tests to `runLanguageSpecificTests()`
- [ ] Update language feature matrix
- [ ] Delete old test file
- [ ] Run tests to ensure nothing broke