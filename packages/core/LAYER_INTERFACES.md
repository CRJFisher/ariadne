# Processing Layer Interfaces

Clear data contracts between processing layers based on PROCESSING_PIPELINE.md architecture.

## Layer 0 → Layer 1: AST to Scope Analysis

```typescript
interface Layer0Output {
  ast: SyntaxNode;
  source: string;
  language: Language;
  file_path: string;
}

// Layer 1 consumes Layer0Output and produces:
interface Layer1Output {
  scope_tree: ScopeTree;
  symbols: Map<string, ScopeSymbol>;
  scope_chains: Map<string, string[]>; // scope_id -> parent_chain
}
```

## Layer 1 → Layer 2: Scope to Module Structure

```typescript
interface Layer1to2Input {
  scope_tree: ScopeTree;
  ast: SyntaxNode;
  source: string;
  language: Language;
}

// Layer 2 produces:
interface Layer2Output {
  imports: ImportInfo[];
  exports: ExportInfo[];
  module_graph: ModuleGraph;
  namespace_map: Map<string, NamespaceInfo>;
}
```

## Layer 2 → Layer 3: Module Structure to Type Definitions

```typescript
interface Layer2to3Input {
  module_graph: ModuleGraph;
  scope_tree: ScopeTree;
  ast: SyntaxNode;
  source: string;
}

// Layer 3 produces:
interface Layer3Output {
  class_definitions: Map<string, ClassDefinition>;
  interface_definitions: Map<string, InterfaceDefinition>;
  type_aliases: Map<string, TypeAlias>;
  enum_definitions: Map<string, EnumDefinition>;
  type_registry: TypeRegistry;
}
```

## Layer 3 → Layer 4: Type Definitions to Inheritance

```typescript
interface Layer3to4Input {
  type_registry: TypeRegistry;
  module_graph: ModuleGraph;
  imports: ImportInfo[];
}

// Layer 4 produces:
interface Layer4Output {
  class_hierarchy: ClassHierarchy;
  method_resolution_order: Map<string, string[]>;
  virtual_methods: Map<string, VirtualMethod[]>;
  trait_implementations: Map<string, TraitImpl[]>;
}
```

## Layer 4 → Layer 5: Inheritance to Type Tracking

```typescript
interface Layer4to5Input {
  type_registry: TypeRegistry;
  class_hierarchy: ClassHierarchy;
  imports: ImportInfo[];
  scope_tree: ScopeTree;
  ast: SyntaxNode;
}

// Layer 5 produces:
interface Layer5Output {
  variable_types: Map<string, TypeInfo[]>; // var -> type history
  type_flow: TypeFlowGraph;
  inferred_types: Map<string, TypeInfo>;
  generic_resolutions: Map<string, ConcreteType>;
}
```

## Layer 5 → Layer 6: Type Tracking to Call Analysis

```typescript
interface Layer5to6Input {
  variable_types: Map<string, TypeInfo[]>;
  class_hierarchy: ClassHierarchy;
  module_graph: ModuleGraph;
  type_registry: TypeRegistry;
  ast: SyntaxNode;
  source: string;
}

// Layer 6 produces:
interface Layer6Output {
  function_calls: FunctionCallInfo[];
  method_calls: MethodCallInfo[];
  constructor_calls: ConstructorCallInfo[];
  call_chains: CallChain[];
  recursive_calls: Set<string>;
}
```

## Layer 6 → Layer 7: Call Analysis to Graph Construction

```typescript
interface Layer6to7Input {
  // All outputs from previous layers
  scope_tree: ScopeTree;
  module_graph: ModuleGraph;
  type_registry: TypeRegistry;
  class_hierarchy: ClassHierarchy;
  variable_types: Map<string, TypeInfo[]>;
  function_calls: FunctionCallInfo[];
  method_calls: MethodCallInfo[];
  constructor_calls: ConstructorCallInfo[];
}

// Layer 7 produces:
interface Layer7Output {
  code_graph: CodeGraph;
  query_interface: GraphQueryInterface;
}
```

## Type Definitions

### Core Types

```typescript
interface ImportInfo {
  imported_name: string;
  local_name: string;
  source_module: string;
  is_type_only?: boolean;
  is_default?: boolean;
  location: Location;
}

interface ExportInfo {
  exported_name: string;
  local_name?: string;
  is_default?: boolean;
  is_type_only?: boolean;
  kind: 'value' | 'type' | 'namespace';
  location: Location;
}

interface ModuleGraph {
  nodes: Map<string, ModuleNode>;
  edges: Map<string, Set<string>>; // from -> to modules
  entry_points: Set<string>;
}

interface TypeRegistry {
  types: Map<string, TypeDefinition>;
  files: Map<string, Set<string>>; // file -> type names
  lookup(name: string, from_file?: string): TypeDefinition | undefined;
}

interface ClassHierarchy {
  classes: Map<string, ClassNode>;
  inheritance: Map<string, string[]>; // child -> parents
  implementations: Map<string, string[]>; // class -> interfaces
  get_ancestors(class_name: string): string[];
  get_descendants(class_name: string): string[];
}

interface TypeFlowGraph {
  nodes: Map<string, TypeFlowNode>;
  edges: Map<string, TypeFlowEdge[]>;
  get_type_at(var_name: string, position: Location): TypeInfo | undefined;
}
```

### Processing Context

Each layer should receive a context object:

```typescript
interface ProcessingContext {
  // Immutable inputs
  readonly ast: SyntaxNode;
  readonly source: string;
  readonly file_path: string;
  readonly language: Language;
  
  // Layer results (immutable, accumulated)
  readonly layer0?: Layer0Output;
  readonly layer1?: Layer1Output;
  readonly layer2?: Layer2Output;
  readonly layer3?: Layer3Output;
  readonly layer4?: Layer4Output;
  readonly layer5?: Layer5Output;
  readonly layer6?: Layer6Output;
}
```

## Implementation Pattern

Each layer module should export:

```typescript
// Example for Layer 2 (Module Structure)
export interface ModuleStructureInput {
  scope_tree: ScopeTree;
  ast: SyntaxNode;
  source: string;
  language: Language;
}

export interface ModuleStructureOutput {
  imports: ImportInfo[];
  exports: ExportInfo[];
  module_graph: ModuleGraph;
}

export function process_module_structure(
  input: ModuleStructureInput
): ModuleStructureOutput {
  // Implementation
}
```

## Event-Based Updates (Future)

For bidirectional data flow:

```typescript
interface LayerEvent {
  source_layer: number;
  target_layer: number;
  event_type: string;
  data: any;
}

interface LayerEventHandler {
  handle_event(event: LayerEvent): void;
}
```

## Validation

Each layer should validate its inputs:

```typescript
function validate_layer_input<T>(
  input: T,
  required_fields: (keyof T)[]
): void {
  for (const field of required_fields) {
    if (!input[field]) {
      throw new Error(`Missing required field: ${String(field)}`);
    }
  }
}
```

## Testing

Each interface should have contract tests:

```typescript
describe('Layer 2 Contract', () => {
  it('produces valid ModuleStructureOutput', () => {
    const input: ModuleStructureInput = {...};
    const output = process_module_structure(input);
    
    expect(output.imports).toBeDefined();
    expect(output.exports).toBeDefined();
    expect(output.module_graph).toBeDefined();
    expect(output.module_graph.nodes.size).toBeGreaterThan(0);
  });
});
```