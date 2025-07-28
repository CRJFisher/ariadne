# @ariadne/core

Core functionality for Ariadne - Find references and definitions in your codebase using tree-sitter.

## Installation

```bash
npm install @ariadne/core
```

## Usage

```typescript
import { Project } from '@ariadne/core';

const project = new Project();
await project.add_or_update_file('src/index.ts', sourceCode);

const definitions = project.get_definitions('src/index.ts');
const references = project.get_references_to_symbol(symbolId);
```

## Documentation

See the [main repository](https://github.com/CRJFisher/ariadne) for full documentation.

## License

ISC