/**
 * Debug test to see what's in the scope tree
 */

import { describe, it, expect } from 'vitest';
import { analyze_file } from './file_analyzer';
import { CodeFile } from './project/file_scanner';

describe('Debug Scope Tree', () => {
  it('should show what scopes are found', async () => {
    const file: CodeFile = {
      file_path: '/test/example.js',
      language: 'javascript',
      source_code: `
        function greet(name = "World", times = 3) {
          for (let i = 0; i < times; i++) {
            console.log("Hello, " + name);
          }
        }
      `
    };

    const { analysis } = await analyze_file(file);
    
    console.log('Analysis scopes:', analysis.scopes);
    console.log('Scope nodes:', Array.from(analysis.scopes.nodes.entries()).map(([id, node]) => ({
      id,
      type: node.type,
      name: node.metadata?.name,
      location: node.location
    })));
    
    console.log('Functions found:', analysis.functions.map(f => ({
      name: f.name,
      params: f.signature.parameters
    })));
    
    expect(true).toBe(true);
  });
});