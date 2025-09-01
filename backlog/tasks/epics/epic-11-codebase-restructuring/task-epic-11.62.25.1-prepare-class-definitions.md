# Task 11.62.25.1: Prepare Class Definitions for Hierarchy Building

**Parent Task:** 11.62.25 - Wire class_hierarchy into code_graph.ts  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 2 hours  
**Created:** 2025-09-01  

## Summary

Convert FileAnalysis class data (ClassInfo) into the Def format expected by build_class_hierarchy, including all necessary metadata for proper hierarchy construction.

## Problem Statement

The code_graph.ts has ClassInfo objects from FileAnalysis, but build_class_hierarchy expects Def objects with specific fields like symbol_id, symbol_kind, range, etc.

## Current Data Flow

```
FileAnalysis.classes: ClassInfo[]
    ↓ (need conversion)
build_class_hierarchy expects: Def[]
```

## Required Conversion

### From ClassInfo (what we have)

```typescript
interface ClassInfo {
  readonly name: ClassName;
  readonly location: Location;
  readonly base_classes?: readonly ClassName[];
  readonly interfaces?: readonly string[];
  readonly is_abstract?: boolean;
  readonly is_exported?: boolean;
  readonly docstring?: DocString;
  readonly decorators?: readonly DecoratorName[];
  readonly methods: readonly MethodInfo[];
  readonly properties: readonly PropertyInfo[];
}
```

### To Def (what build_class_hierarchy expects)

```typescript
interface Def {
  name: string;
  symbol_id: string;  // Must generate
  symbol_kind: string;  // 'class', 'interface', etc.
  file_path: string;
  range: {
    start: Position;
    end: Position;
  };
  // ... other fields
}
```

## Implementation

### Step 1: Create ClassInfo to Def Converter

```typescript
function class_info_to_def(
  info: ClassInfo,
  file_path: string,
  language: Language
): Def {
  // Generate symbol_id
  const symbol_id = `${file_path}#${info.name}`;
  
  // Determine symbol_kind
  const symbol_kind = determine_symbol_kind(info, language);
  
  // Convert Location to range
  const range = location_to_range(info.location);
  
  return {
    name: info.name,
    symbol_id,
    symbol_kind,
    file_path,
    range,
    language,
    // Add other required fields
    kind: 'class',
    location: info.location,
    references: []  // Empty for now
  };
}

function determine_symbol_kind(info: ClassInfo, language: Language): string {
  // Heuristics to determine if class, interface, trait, etc.
  if (info.is_abstract && language === 'typescript') {
    return 'interface';  // Could be abstract class or interface
  }
  if (language === 'rust') {
    // Check decorators/context for trait vs struct
    return 'struct';  // Default for Rust
  }
  return 'class';  // Default
}

function location_to_range(loc: Location): Range {
  return {
    start: {
      row: loc.line - 1,  // Convert to 0-based
      column: loc.column
    },
    end: {
      row: loc.end_line - 1,
      column: loc.end_column
    }
  };
}
```

### Step 2: Update build_class_hierarchy_from_analyses

```typescript
async function build_class_hierarchy_from_analyses(
  analyses: FileAnalysis[]
): Promise<ClassHierarchy> {
  // Convert all ClassInfo to Def
  const all_definitions: Def[] = [];
  const contexts = new Map<string, ClassHierarchyContext>();
  
  for (const analysis of analyses) {
    // Convert each class to Def
    for (const classInfo of analysis.classes) {
      const def = class_info_to_def(
        classInfo,
        analysis.file_path,
        analysis.language
      );
      all_definitions.push(def);
    }
    
    // Create context for this file
    // Problem: We don't have the AST tree anymore!
    contexts.set(analysis.file_path, {
      tree: null,  // Need to preserve or reconstruct
      source_code: '',  // Need to preserve
      file_path: analysis.file_path,
      language: analysis.language,
      all_definitions  // Pass all definitions
    });
  }
  
  // Call the actual build_class_hierarchy
  const hierarchy = build_class_hierarchy(
    all_definitions,
    contexts
  );
  
  return hierarchy;
}
```

### Step 3: Handle Missing AST Problem

The AST is discarded after analyze_file. We need to either:

**Option A: Preserve AST**
```typescript
interface ExtendedFileAnalysis extends FileAnalysis {
  ast?: Tree;
  source_code?: string;
}
```

**Option B: Make AST Optional**
Update build_class_hierarchy to work without AST for relationship extraction.

**Option C: Re-parse When Needed**
Store source and re-parse only when building hierarchy.

## Acceptance Criteria

- [ ] ClassInfo to Def converter implemented
- [ ] Symbol IDs properly generated
- [ ] Symbol kinds correctly determined
- [ ] Location/range conversion working
- [ ] AST availability issue resolved
- [ ] build_class_hierarchy properly called
- [ ] All class metadata preserved

## Testing Plan

1. Test ClassInfo to Def conversion
2. Test symbol_id generation uniqueness
3. Test symbol_kind determination for each language
4. Test with classes having inheritance
5. Test with interfaces and traits
6. Verify hierarchy is actually built (not empty)

## Challenges

1. **AST Not Available** - Need to decide how to handle
2. **Symbol Kind Determination** - Heuristics may not be perfect
3. **Missing Metadata** - Def might not capture all ClassInfo fields
4. **Performance** - Converting all classes might be slow

## Next Steps

- Task 11.62.25.2: Create ClassHierarchyContext properly
- Task 11.62.25.3: Handle AST availability issue
- Task 11.62.25.4: Test hierarchy building with real data