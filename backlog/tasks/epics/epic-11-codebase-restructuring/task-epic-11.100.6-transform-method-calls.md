# Task 11.100.6: Transform method_calls to Tree-sitter Queries

## Parent Task
11.100 - Transform Entire Codebase to Tree-sitter Query System

## Module Overview
**Location**: `src/call_graph/method_calls/`
**Files**: 6+ files (~1,800 lines)
- `method_calls.ts` - Generic processor
- `method_calls.javascript.ts` - JS method calls
- `method_calls.typescript.ts` - TS-specific
- `method_calls.python.ts` - Python methods
- `method_calls.rust.ts` - Rust methods

## Current Implementation

### Complex Receiver Resolution
```typescript
function find_method_calls(node: SyntaxNode) {
  if (node.type === 'call_expression') {
    const function = node.childForFieldName('function');
    
    if (function.type === 'member_expression') {
      const object = function.childForFieldName('object');
      const property = function.childForFieldName('property');
      
      // Determine receiver type
      const receiverType = inferReceiverType(object);
      const methodName = property.text;
      
      // Check if it's chained
      const isChained = object.type === 'call_expression';
      // ... complex logic
    }
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern
```scheme
;; method_call_queries.scm

;; JavaScript/TypeScript method calls
(call_expression
  function: (member_expression
    object: (_) @call.method.receiver
    property: (property_identifier) @call.method.name)
  arguments: (arguments) @call.method.args) @call.method

;; Optional chaining ?.
(call_expression
  function: (member_expression
    object: (_) @call.method.receiver
    optional_chain: (optional_chain) @call.method.optional
    property: (property_identifier) @call.method.name)
  arguments: (arguments) @call.method.args) @call.method.optional_chain

;; Chained method calls
(call_expression
  function: (member_expression
    object: (call_expression) @call.method.chained_from
    property: (property_identifier) @call.method.name)
  arguments: (arguments) @call.method.args) @call.method.chained

;; Python method calls
(call
  function: (attribute
    object: (_) @call.method.receiver
    attribute: (identifier) @call.method.name)
  arguments: (argument_list) @call.method.args) @call.method

;; Python special methods (dunder)
(call
  function: (attribute
    object: (_) @call.method.receiver
    attribute: (identifier) @call.method.name
    (#match? @call.method.name "^__.*__$"))
  arguments: (argument_list) @call.method.args) @call.method.dunder

;; Rust method calls
(call_expression
  function: (field_expression
    value: (_) @call.method.receiver
    field: (field_identifier) @call.method.name)
  arguments: (arguments) @call.method.args) @call.method

;; Rust trait method calls
(call_expression
  function: (scoped_identifier
    path: (identifier) @call.method.trait
    name: (identifier) @call.method.name)
  arguments: (arguments
    (_) @call.method.receiver
    (_)* @call.method.other_args)) @call.method.trait_call
```

### New Implementation
```typescript
export function find_method_calls_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): MethodCallInfo[] {
  const query = loadMethodCallQuery(language);
  const captures = query.captures(tree.rootNode);
  
  // Group by method call
  const methodGroups = groupByMethodCall(captures);
  
  return methodGroups.map(group => {
    const receiver = extractReceiver(group);
    const methodName = extractMethodName(group);
    
    return {
      receiver_name: receiver.name,
      receiver_type: receiver.type, // Would need type inference
      method_name: methodName,
      arguments_count: countMethodArgs(group),
      is_chained_call: isChainedCall(group),
      is_optional_chain: hasOptionalChain(group),
      location: group[0].node.startPosition
    };
  });
}
```

## Transformation Steps

### 1. Document Method Call Patterns
- [ ] Simple method calls (obj.method())
- [ ] Chained calls (obj.method1().method2())
- [ ] Optional chaining (obj?.method())
- [ ] Super calls
- [ ] Static method calls
- [ ] Trait methods (Rust)

### 2. Create Method Queries
- [ ] Distinguish from function calls
- [ ] Capture receiver information
- [ ] Track chaining
- [ ] Handle special methods

### 3. Build Method Extractor
- [ ] Extract receiver and type
- [ ] Get method name
- [ ] Track call chains
- [ ] Count arguments

### 4. Integrate Type Information
- [ ] Link to type tracking
- [ ] Resolve receiver types
- [ ] Handle dynamic dispatch

## Expected Improvements

### Code Reduction
- **Before**: ~1,800 lines
- **After**: ~200 lines + queries
- **Reduction**: 89%

### Accuracy
- Better chained call detection
- Handles all optional chaining

## Success Criteria
- [ ] All method calls detected
- [ ] Receivers properly identified
- [ ] Chaining tracked correctly
- [ ] 85%+ code reduction