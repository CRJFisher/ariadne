---
id: task-epic-11.100.0.5.19.15.3
title: Add comprehensive tests for extract_namespaces function
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['testing', 'test-coverage', 'namespace-analysis']
dependencies: ['task-epic-11.100.0.5.19.15.1']
parent_task_id: task-epic-11.100.0.5.19.15
priority: medium
---

## Description

Add comprehensive test coverage for the new `extract_namespaces` function across all supported languages.

## Test Structure

Create test files following the established pattern:
- `namespace_resolution.extract_namespaces.test.ts` - Main test suite
- Individual language-specific test sections within the file

## Test Categories

### 1. Basic Namespace Extraction

#### JavaScript/TypeScript
```typescript
describe('JavaScript namespace extraction', () => {
  it('should extract namespace imports', async () => {
    const code = `
      import * as utils from './utils';
      import * as lodash from 'lodash';
      import { something } from './other'; // should not be extracted
    `;

    const imports = extract_namespaces(parse(code), code, 'javascript', 'test.js');

    expect(imports).toHaveLength(2);
    expect(imports[0]).toMatchObject({
      kind: 'namespace',
      namespace_name: 'utils',
      source: './utils'
    });
  });
});
```

#### Python
```typescript
describe('Python namespace extraction', () => {
  it('should extract module imports as namespaces', async () => {
    const code = `
      import os
      import sys.path
      from collections import *
      from typing import List  # should not be extracted
    `;

    const imports = extract_namespaces(parse(code), code, 'python', 'test.py');

    expect(imports).toHaveLength(3); // os, sys.path, collections.*
  });
});
```

#### Rust
```typescript
describe('Rust namespace extraction', () => {
  it('should extract use wildcards as namespaces', async () => {
    const code = `
      use std::collections::*;
      use super::utils::*;
      use crate::models::User; // should not be extracted
    `;

    const imports = extract_namespaces(parse(code), code, 'rust', 'test.rs');

    expect(imports).toHaveLength(2);
  });
});
```

### 2. Edge Cases

#### Complex Module Paths
```typescript
it('should handle complex module paths', () => {
  const code = `
    import * as deep from '../../../utils/deep/nested';
    import * as scoped from '@company/package/submodule';
  `;

  const imports = extract_namespaces(parse(code), code, 'javascript', 'test.js');

  expect(imports[0].source).toBe('../../../utils/deep/nested');
  expect(imports[1].source).toBe('@company/package/submodule');
});
```

#### Namespace Aliases
```typescript
it('should preserve namespace aliases', () => {
  const code = `import * as myUtils from './utilities';`;

  const imports = extract_namespaces(parse(code), code, 'javascript', 'test.js');

  expect(imports[0].namespace_name).toBe('myUtils');
  expect(imports[0].source).toBe('./utilities');
});
```

#### Mixed Imports (Should Filter)
```typescript
it('should only extract namespace imports from mixed statements', () => {
  const code = `
    import React, { useState } from 'react';
    import * as utils from './utils';
    import { Button } from './components';
    import './styles.css';
  `;

  const imports = extract_namespaces(parse(code), code, 'javascript', 'test.js');

  expect(imports).toHaveLength(1);
  expect(imports[0].namespace_name).toBe('utils');
});
```

### 3. Location Information

```typescript
it('should include accurate location information', () => {
  const code = `import * as utils from './utils';\n`;

  const imports = extract_namespaces(parse(code), code, 'javascript', 'test.js');

  expect(imports[0].location).toMatchObject({
    line: 1,
    column: expect.any(Number),
    end_line: 1,
    end_column: expect.any(Number),
    file_path: 'test.js'
  });
});
```

### 4. Language-Specific Features

#### TypeScript Namespaces
```typescript
it('should handle TypeScript namespace declarations', () => {
  const code = `
    namespace MyNamespace {
      export function test() {}
    }
  `;

  // This might be handled differently - may not be an "import"
  // Test based on actual implementation decisions
});
```

#### Python Package Imports
```typescript
it('should handle Python package imports', () => {
  const code = `
    import package.subpackage
    from package import submodule
  `;

  const imports = extract_namespaces(parse(code), code, 'python', 'test.py');

  expect(imports).toContainEqual(expect.objectContaining({
    kind: 'namespace',
    source: expect.stringContaining('package')
  }));
});
```

### 5. Integration Tests

```typescript
describe('Integration with existing namespace resolution', () => {
  it('should work with detect_namespace_imports', () => {
    const code = `import * as utils from './utils';`;

    const extracted = extract_namespaces(parse(code), code, 'javascript', 'test.js');
    const detected = detect_namespace_imports(extracted, 'javascript');

    expect(detected).toHaveLength(1);
    expect(detected[0].namespace_name).toBe('utils');
  });
});
```

### 6. Performance Tests

```typescript
describe('Performance', () => {
  it('should handle large files efficiently', () => {
    const largeCode = Array(1000).fill('import * as utils from "./utils";').join('\n');

    const start = performance.now();
    const imports = extract_namespaces(parse(largeCode), largeCode, 'javascript', 'test.js');
    const duration = performance.now() - start;

    expect(imports).toHaveLength(1000);
    expect(duration).toBeLessThan(100); // Should complete in <100ms
  });
});
```

### 7. Error Handling

```typescript
describe('Error handling', () => {
  it('should handle malformed code gracefully', () => {
    const malformedCode = 'import * as utils from'; // incomplete

    expect(() => {
      extract_namespaces(parse(malformedCode), malformedCode, 'javascript', 'test.js');
    }).not.toThrow();
  });

  it('should return empty array for unsupported language', () => {
    const code = 'import * as utils from "./utils";';

    const imports = extract_namespaces(parse(code), code, 'go' as any, 'test.go');

    expect(imports).toEqual([]);
  });
});
```

## Test Utilities Needed

### Helper Functions
```typescript
// Test helper for parsing code
function parse(code: string, language: Language = 'javascript'): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(getLanguage(language));
  return parser.parse(code).rootNode;
}

// Helper for creating expected Import objects
function createExpectedNamespaceImport(
  namespace_name: string,
  source: string,
  location?: Partial<Location>
): NamespaceImport {
  return {
    kind: 'namespace',
    namespace_name: namespace_name as NamespaceName,
    source: source as ModulePath,
    location: location || expect.any(Object),
    language: expect.any(String),
    is_type_only: false,
    is_dynamic: false
  };
}
```

## Coverage Goals

- [ ] 100% line coverage for extract_namespaces function
- [ ] All supported languages covered
- [ ] All major namespace import patterns covered
- [ ] Edge cases and error conditions covered
- [ ] Performance characteristics validated
- [ ] Integration points tested

## Dependencies

- Requires task 11.100.0.5.19.15.1 (implementation) to be completed first
- Requires proper tree-sitter setup for all languages
- May require test fixture files for complex scenarios

## Success Criteria

- [ ] All tests pass
- [ ] 100% code coverage on new function
- [ ] Tests run in CI/CD pipeline
- [ ] Performance benchmarks established
- [ ] Documentation includes test examples