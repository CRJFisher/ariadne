# Feature Development Guide

## Overview

This guide explains how to add new features to Ariadne following the feature-based architecture pattern. Features should be organized by category and support multiple programming languages through a consistent adapter pattern.

## Feature Development Workflow

### Step 1: Define the Feature

Determine where your feature belongs:

- **Import Resolution**: How code references other code
- **Call Graph**: Function and method invocations  
- **Type System**: Type inference and tracking
- **Scope Resolution**: Variable and symbol scoping
- **Export Detection**: Module public interfaces
- **Inheritance**: Class and trait relationships

### Step 2: Create Feature Structure

```bash
# Example: Adding method chaining detection
mkdir -p src/call_graph/method_chaining
cd src/call_graph/method_chaining
```

Create the following files:

```
method_chaining/
├── README.md                          # Feature documentation
├── method_chaining.contract.ts        # Test contract
├── method_chaining.ts                 # Core implementation
├── method_chaining.test.ts           # Test utilities
├── method_chaining.javascript.ts      # JS adapter
├── method_chaining.javascript.test.ts # JS tests
├── method_chaining.python.ts         # Python adapter
├── method_chaining.python.test.ts    # Python tests
├── method_chaining.rust.ts           # Rust adapter
├── method_chaining.rust.test.ts      # Rust tests
└── method_chaining.typescript.test.ts # TS tests (uses JS adapter)
```

### Step 3: Define the Test Contract

Create `[feature].contract.ts`:

```typescript
import { FeatureContract, TestCase } from '../../core/contracts';

export const MethodChainingContract: FeatureContract = {
  meta: {
    name: 'method_chaining',
    category: 'call_graph',
    description: 'Detect and analyze chained method calls',
    universalSupport: true  // All languages must support this
  },
  
  testCases: [
    {
      name: 'simple_chain',
      description: 'Detect basic method chaining',
      required: true,
      fixture: {
        javascript: 'obj.method1().method2()',
        python: 'obj.method1().method2()',
        rust: 'obj.method1().method2()',
      },
      assertions: [
        { type: 'chain_length', value: 2 },
        { type: 'methods_called', value: ['method1', 'method2'] }
      ]
    },
    {
      name: 'nested_chain',
      description: 'Detect nested method chains',
      required: true,
      fixture: {
        javascript: 'obj.method1(other.method2()).method3()',
        python: 'obj.method1(other.method2()).method3()',
        rust: 'obj.method1(other.method2()).method3()',
      },
      assertions: [
        { type: 'chain_length', value: 2 },
        { type: 'nested_chains', value: 1 }
      ]
    }
  ],
  
  languageExtensions: {
    javascript: [
      {
        name: 'optional_chaining',
        description: 'JavaScript optional chaining operator',
        required: false,
        fixture: { 
          javascript: 'obj?.method1()?.method2()' 
        },
        assertions: [
          { type: 'optional_chain', value: true }
        ]
      }
    ],
    rust: [
      {
        name: 'result_chaining',
        description: 'Rust Result type chaining',
        required: false,
        fixture: { 
          rust: 'result.map(|x| x + 1).unwrap_or(0)' 
        },
        assertions: [
          { type: 'result_chain', value: true }
        ]
      }
    ]
  }
};
```

### Step 4: Implement Core Abstraction

Create `[feature].ts`:

```typescript
import { ASTNode } from '../../types';

export interface MethodChain {
  startNode: ASTNode;
  methods: MethodCall[];
  length: number;
  isOptional?: boolean;
}

export interface MethodCall {
  name: string;
  arguments: ASTNode[];
  returnType?: string;
}

export abstract class MethodChainingDetector {
  abstract readonly language: string;
  
  // Core detection logic
  abstract detectChains(ast: ASTNode): MethodChain[];
  
  // Analyze chain characteristics
  abstract analyzeChain(chain: MethodChain): ChainAnalysis;
  
  // Shared utility methods
  protected isMethodCall(node: ASTNode): boolean {
    return node.type === 'call_expression' || 
           node.type === 'member_expression';
  }
  
  protected getChainLength(chain: MethodChain): number {
    return chain.methods.length;
  }
}

export interface ChainAnalysis {
  length: number;
  methods: string[];
  hasOptionalChaining: boolean;
  hasNestedChains: boolean;
  complexity: number;
}
```

### Step 5: Implement Language Adapters

Create `[feature].[language].ts`:

```typescript
// method_chaining.javascript.ts
import { MethodChainingDetector, MethodChain } from './method_chaining';
import { ASTNode } from '../../types';

export class JavaScriptMethodChainingDetector extends MethodChainingDetector {
  readonly language = 'javascript';
  
  detectChains(ast: ASTNode): MethodChain[] {
    const chains: MethodChain[] = [];
    
    this.traverse(ast, (node) => {
      if (this.isChainStart(node)) {
        const chain = this.buildChain(node);
        if (chain.length > 1) {
          chains.push(chain);
        }
      }
    });
    
    return chains;
  }
  
  private isChainStart(node: ASTNode): boolean {
    // JavaScript-specific logic to identify chain starts
    return node.type === 'member_expression' &&
           node.parent?.type === 'call_expression';
  }
  
  private buildChain(startNode: ASTNode): MethodChain {
    const methods: MethodCall[] = [];
    let current = startNode;
    
    while (current && this.isMethodCall(current)) {
      methods.push({
        name: this.getMethodName(current),
        arguments: this.getArguments(current)
      });
      current = current.parent;
    }
    
    return {
      startNode,
      methods,
      length: methods.length,
      isOptional: this.hasOptionalChaining(startNode)
    };
  }
  
  private hasOptionalChaining(node: ASTNode): boolean {
    // Check for ?. operator
    return node.text?.includes('?.') || false;
  }
  
  analyzeChain(chain: MethodChain): ChainAnalysis {
    return {
      length: chain.length,
      methods: chain.methods.map(m => m.name),
      hasOptionalChaining: chain.isOptional || false,
      hasNestedChains: this.hasNestedChains(chain),
      complexity: this.calculateComplexity(chain)
    };
  }
}
```

### Step 6: Write Tests

Create `[feature].[language].test.ts`:

```typescript
// method_chaining.javascript.test.ts
import { describe, test, expect } from 'vitest';
import { MethodChainingContract } from './method_chaining.contract';
import { JavaScriptMethodChainingDetector } from './method_chaining.javascript';
import { createJavaScriptProject } from '../../test-utils';

describe('method_chaining - JavaScript', () => {
  const detector = new JavaScriptMethodChainingDetector();
  
  // Implement required contract tests
  test('simple_chain', () => {
    const code = 'obj.method1().method2()';
    const project = createJavaScriptProject(code);
    const ast = project.getAST();
    
    const chains = detector.detectChains(ast);
    
    expect(chains).toHaveLength(1);
    expect(chains[0].length).toBe(2);
    expect(chains[0].methods.map(m => m.name)).toEqual(['method1', 'method2']);
  });
  
  test('nested_chain', () => {
    const code = 'obj.method1(other.method2()).method3()';
    const project = createJavaScriptProject(code);
    const ast = project.getAST();
    
    const chains = detector.detectChains(ast);
    const analysis = detector.analyzeChain(chains[0]);
    
    expect(chains[0].length).toBe(2);
    expect(analysis.hasNestedChains).toBe(true);
  });
  
  // JavaScript-specific extension test
  test('optional_chaining', () => {
    const code = 'obj?.method1()?.method2()';
    const project = createJavaScriptProject(code);
    const ast = project.getAST();
    
    const chains = detector.detectChains(ast);
    
    expect(chains[0].isOptional).toBe(true);
  });
});
```

### Step 7: Document the Feature

Create `README.md`:

```markdown
# Method Chaining Detection

## Overview

This feature detects and analyzes method chaining patterns in code, where multiple methods are called sequentially on the return values of previous calls.

## Language Support

| Language   | Support Level | Notes                          |
|------------|--------------|--------------------------------|
| JavaScript | ✅ Full      | Includes optional chaining (?.) |
| TypeScript | ✅ Full      | Same as JavaScript             |
| Python     | ✅ Full      | Standard method chaining       |
| Rust       | ✅ Full      | Includes Result/Option chains  |

## Usage

\```typescript
import { MethodChainingDetector } from '@ariadne/core';

const detector = MethodChainingDetector.forLanguage('javascript');
const chains = detector.detectChains(ast);

chains.forEach(chain => {
  console.log(`Found chain of length ${chain.length}`);
  console.log(`Methods: ${chain.methods.map(m => m.name).join(' -> ')}`);
});
\```

## Patterns Detected

### Basic Chaining
\```javascript
// JavaScript
array.filter(x => x > 0).map(x => x * 2).reduce((a, b) => a + b);

// Python  
df.filter(lambda x: x > 0).map(lambda x: x * 2).sum()

// Rust
vec.iter().filter(|x| x > 0).map(|x| x * 2).sum()
\```

### Optional Chaining (JavaScript/TypeScript)
\```javascript
user?.profile?.settings?.theme
\```

### Builder Pattern
\```rust
Client::new()
  .timeout(Duration::from_secs(10))
  .max_retries(3)
  .build()
\```

## Implementation Notes

- Chains are detected by traversing member access expressions
- Nested chains (chains within arguments) are tracked separately
- Optional chaining is specific to JavaScript/TypeScript
- Rust includes special handling for Result and Option types

## Test Coverage

All languages implement the following test cases:
- Simple chain detection
- Nested chain detection
- Long chain detection (5+ methods)
- Chains with arguments
- Chains with different return types

Language-specific tests:
- JavaScript: Optional chaining, array methods
- Python: Pandas-style chaining, list comprehensions
- Rust: Iterator chains, Result/Option chains

## Performance Considerations

- Chain detection is O(n) where n is the number of AST nodes
- Chains are detected in a single pass
- Results are cached per file

## Limitations

- Dynamic method calls may not be detected
- Chains broken across multiple statements are not linked
- Type information for intermediate values is not always available
```

### Step 8: Validate Implementation

Run validation to ensure compliance:

```bash
# Validate feature structure
npm run validate:feature method_chaining

# Check test coverage
npm run test:coverage method_chaining

# Generate missing test stubs
npm run generate:test-stubs method_chaining
```

## Best Practices

### DO:
- ✅ Define clear test contracts
- ✅ Implement all required tests
- ✅ Document language-specific behavior
- ✅ Use shared utilities in base classes
- ✅ Keep adapters focused on language differences
- ✅ Add comprehensive error handling

### DON'T:
- ❌ Skip required test cases
- ❌ Duplicate logic across adapters
- ❌ Mix feature categories
- ❌ Hardcode language-specific logic in core
- ❌ Forget to update documentation
- ❌ Leave TODO comments in production code

## Common Patterns

### Pattern 1: Optional Feature Support

```typescript
// In contract
testCases: [
  {
    name: 'feature_x',
    required: false,  // Optional for some languages
    skipLanguages: ['rust'],  // Explicitly skip
    // ...
  }
]
```

### Pattern 2: Language-Specific Preprocessing

```typescript
class PythonAdapter extends FeatureAdapter {
  preprocess(ast: ASTNode): ASTNode {
    // Python-specific AST transformations
    return this.handleIndentation(ast);
  }
}
```

### Pattern 3: Shared Test Utilities

```typescript
// In [feature].test.ts
export function createTestFixture(language: string): TestFixture {
  // Shared fixture creation
}

export function assertFeatureDetected(result: any, expected: any) {
  // Shared assertions
}
```

## Troubleshooting

### Issue: Tests passing locally but failing in CI

**Solution**: Ensure all test fixtures use consistent formatting and check for OS-specific line endings.

### Issue: Language adapter not being recognized

**Solution**: Register the adapter in the language configuration:

```typescript
// languages/javascript/index.ts
import { JavaScriptMethodChainingDetector } from '../../call_graph/method_chaining';

export const javascriptConfig = {
  // ...
  adapters: {
    method_chaining: JavaScriptMethodChainingDetector
  }
};
```

### Issue: Contract validation failing

**Solution**: Run the validation with verbose output:

```bash
npm run validate:feature -- --verbose method_chaining
```

## Migration Guide

If migrating an existing feature to the new structure:

1. Create new folder structure
2. Extract test cases into contract
3. Split implementation into adapters
4. Migrate tests to use contract
5. Update imports throughout codebase
6. Remove old implementation
7. Run full test suite

## Resources

- [Architecture Overview](./ARCHITECTURE.md)
- [Testing Contracts](./TESTING_CONTRACTS.md)
- [Language Support Guide](./LANGUAGE_SUPPORT.md)
- [Migration Examples](../packages/core/docs/migration-examples/)