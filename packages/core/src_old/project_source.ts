/**
 * Source code extraction methods for Project class
 */

import { Def, ScopeGraph } from './graph';
import { LanguageConfig } from './types';
import Parser from 'tree-sitter';

interface FileCache {
  tree: any;
  source_code: string;
  graph: ScopeGraph;
}

export class ProjectSource {
  private file_cache: Map<string, FileCache>;
  private languages: Map<string, LanguageConfig>;

  constructor(
    file_cache: Map<string, FileCache>,
    languages: Map<string, LanguageConfig>
  ) {
    this.file_cache = file_cache;
    this.languages = languages;
  }

  /**
   * Get the exact source code for a definition
   * @param def The definition to get source for
   * @param file_path The file containing the definition
   * @returns The exact source code for the definition
   */
  get_source_code(def: Def, file_path: string): string {
    const fileCache = this.file_cache.get(file_path);
    if (!fileCache) {
      return '';
    }
    
    // For functions/methods, we need to find the enclosing function/method node
    // since the definition only captures the identifier
    if (['function', 'method', 'generator'].includes(def.symbol_kind)) {
      const defNode = fileCache.tree.rootNode.descendantForPosition(
        { row: def.range.start.row, column: def.range.start.column },
        { row: def.range.end.row, column: def.range.end.column }
      );
      
      if (defNode) {
        // Walk up to find the function/method declaration or expression
        let current = defNode;
        while (current) {
          const nodeType = current.type;
          
          // Check for various function-like nodes across languages
          const functionTypes = [
            // JavaScript/TypeScript
            'function_declaration',
            'method_definition', 
            'arrow_function',
            'function_expression',
            'generator_function_declaration',
            // Python
            'function_definition',
            // Rust
            'function_item',
            'impl_item'
          ];
          
          if (functionTypes.includes(nodeType)) {
            const startPos = current.startPosition;
            const endPos = current.endPosition;
            
            const lines = fileCache.source_code.split('\n');
            const startLine = startPos.row;
            const endLine = endPos.row;
            
            if (startLine === endLine) {
              return lines[startLine].substring(startPos.column, endPos.column);
            } else {
              const result = [];
              result.push(lines[startLine].substring(startPos.column));
              for (let i = startLine + 1; i < endLine; i++) {
                result.push(lines[i]);
              }
              result.push(lines[endLine].substring(0, endPos.column));
              return result.join('\n');
            }
          }
          
          current = current.parent;
        }
      }
    }
    
    // For non-functions or if we couldn't find the enclosing node,
    // use the definition range
    const lines = fileCache.source_code.split('\n');
    const startLine = def.range.start.row;
    const endLine = def.range.end.row;
    
    // Check for out-of-bounds ranges
    if (startLine >= lines.length || endLine >= lines.length || startLine < 0 || endLine < 0) {
      return '';
    }
    
    if (startLine === endLine) {
      return lines[startLine]?.substring(def.range.start.column, def.range.end.column) || '';
    } else {
      const result = [];
      const firstLine = lines[startLine]?.substring(def.range.start.column);
      if (firstLine) result.push(firstLine);
      
      for (let i = startLine + 1; i < endLine && i < lines.length; i++) {
        if (lines[i] !== undefined) result.push(lines[i]);
      }
      
      if (endLine < lines.length && lines[endLine]) {
        const lastLine = lines[endLine].substring(0, def.range.end.column);
        if (lastLine) result.push(lastLine);
      }
      
      return result.filter(line => line !== '').join('\n');
    }
  }

  /**
   * Get source code with surrounding context, docstrings, and decorators
   * @param def The definition to get source for
   * @param file_path The file containing the definition  
   * @param context_lines Number of lines before and after to include
   * @returns Object containing source, docstring, and decorators
   */
  get_source_with_context(def: Def, file_path: string, context_lines: number = 0): {
    source: string;
    docstring?: string;
    decorators?: string[];
  } {
    const fileCache = this.file_cache.get(file_path);
    if (!fileCache) {
      return { source: '' };
    }
    
    const lines = fileCache.source_code.split('\n');
    
    // Get the basic source
    const source = this.get_source_code(def, file_path);
    
    // Get language-specific context extraction
    const config = this.get_language_config(file_path);
    let docstring: string | undefined;
    let decorators: string[] | undefined;
    
    if (config && config.extract_context && ['function', 'method', 'generator'].includes(def.symbol_kind)) {
      // Find the AST node for this definition
      const defNode = fileCache.tree.rootNode.descendantForPosition(
        { row: def.range.start.row, column: def.range.start.column },
        { row: def.range.end.row, column: def.range.end.column }
      );
      
      if (defNode) {
        // Walk up to find the function/method node
        let functionNode = defNode;
        while (functionNode && !this.is_function_like_node(functionNode)) {
          functionNode = functionNode.parent;
        }
        
        if (functionNode) {
          const context = config.extract_context(functionNode, lines, def.range.start.row);
          docstring = context.docstring;
          decorators = context.decorators;
        }
      }
    }
    
    // Add context lines if requested
    let contextSource = source;
    if (context_lines > 0) {
      const sourceLines = source.split('\n');
      const firstSourceLine = lines.findIndex(line => line.includes(sourceLines[0]));
      const lastSourceLine = firstSourceLine + sourceLines.length - 1;
      
      const startLine = Math.max(0, firstSourceLine - context_lines);
      const endLine = Math.min(lines.length - 1, lastSourceLine + context_lines);
      
      const contextLines = [];
      for (let i = startLine; i <= endLine; i++) {
        contextLines.push(lines[i]);
      }
      contextSource = contextLines.join('\n');
    }
    
    return {
      source: contextSource,
      docstring,
      decorators
    };
  }

  /**
   * Get language configuration for a file
   */
  private get_language_config(file_path: string): LanguageConfig | undefined {
    const ext = file_path.split('.').pop() || '';
    
    for (const [_, config] of this.languages) {
      if (config.file_extensions.includes(ext)) {
        return config;
      }
    }
    
    return undefined;
  }

  /**
   * Check if a node is a function-like node
   */
  private is_function_like_node(node: any): boolean {
    const functionTypes = [
      'function_declaration',
      'method_definition',
      'arrow_function', 
      'function_expression',
      'generator_function_declaration',
      'function_definition',
      'function_item',
      'impl_item'
    ];
    
    return functionTypes.includes(node.type);
  }
}