#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to extract TypeScript type definitions from the main ast-climber source
 * and generate the corresponding .d.ts files for the ast-climber-types package.
 */

const SOURCE_DIR = path.join(__dirname, '../../../src');
const TARGET_DIR = path.join(__dirname, '../types');

// Map of source files to target type files and what to extract
const TYPE_MAPPINGS = {
  'graph.ts': {
    target: 'common.d.ts',
    types: ['Point', 'SimpleRange', 'Scoping', 'FunctionMetadata'],
    extract: true
  },
  'graph.ts:definitions': {
    target: 'definitions.d.ts',
    types: ['Def', 'Ref', 'Import', 'Scope', 'Node', 'FunctionCall', 'ImportInfo'],
    extract: true
  },
  'graph.ts:edges': {
    target: 'edges.d.ts',
    types: ['DefToScope', 'RefToDef', 'ScopeToScope', 'ImportToScope', 'RefToImport', 'Edge'],
    extract: true
  },
  'graph.ts:graph': {
    target: 'graph.d.ts',
    types: ['Call', 'CallGraphOptions', 'CallGraphNode', 'CallGraphEdge', 'CallGraph'],
    extract: true
  },
  'edit.ts': {
    target: 'common.d.ts',
    types: ['Edit'],
    extract: true
  },
  'types.ts': {
    target: 'common.d.ts',
    types: ['ExtractedContext', 'LanguageConfig'],
    extract: true
  }
};

/**
 * Extract type definitions from source file
 */
function extractTypes(sourceFile, typeNames) {
  const sourcePath = path.join(SOURCE_DIR, sourceFile.split(':')[0]);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    return [];
  }
  
  const content = fs.readFileSync(sourcePath, 'utf8');
  const extractedTypes = [];
  
  // Simple regex-based extraction (could be improved with AST parsing)
  typeNames.forEach(typeName => {
    // Match interfaces
    const interfaceRegex = new RegExp(`export\\s+interface\\s+${typeName}[\\s\\S]*?^}`, 'gm');
    const interfaceMatch = content.match(interfaceRegex);
    if (interfaceMatch) {
      extractedTypes.push({
        name: typeName,
        definition: interfaceMatch[0]
      });
    }
    
    // Match type aliases
    const typeRegex = new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*[^;]+;`, 'gm');
    const typeMatch = content.match(typeRegex);
    if (typeMatch) {
      extractedTypes.push({
        name: typeName,
        definition: typeMatch[0]
      });
    }
    
    // Match enums
    const enumRegex = new RegExp(`export\\s+enum\\s+${typeName}\\s*{[^}]+}`, 'gm');
    const enumMatch = content.match(enumRegex);
    if (enumMatch) {
      extractedTypes.push({
        name: typeName,
        definition: enumMatch[0]
      });
    }
  });
  
  return extractedTypes;
}

/**
 * Sync types from source to the types package
 */
function syncTypes() {
  console.log('Extracting types from ast-climber source...');
  
  // This is a placeholder for now - in practice, we'd need a more sophisticated
  // approach using the TypeScript compiler API to properly extract types
  console.log('Type extraction would happen here using TypeScript compiler API');
  console.log('For now, types have been manually created in the types/ directory');
  
  // Verify all type files exist
  const typeFiles = ['common.d.ts', 'definitions.d.ts', 'edges.d.ts', 'graph.d.ts'];
  let allFilesExist = true;
  
  typeFiles.forEach(file => {
    const filePath = path.join(TARGET_DIR, file);
    if (fs.existsSync(filePath)) {
      console.log(`✓ ${file} exists`);
    } else {
      console.log(`✗ ${file} missing`);
      allFilesExist = false;
    }
  });
  
  if (allFilesExist) {
    console.log('\nAll type definition files are present!');
  } else {
    console.error('\nSome type files are missing!');
    process.exit(1);
  }
}

// Run the sync
syncTypes();