#!/usr/bin/env tsx

/**
 * File size check script to prevent tree-sitter parsing failures
 * Warns at 28KB and errors at 32KB (tree-sitter's limit)
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const WARNING_THRESHOLD = 28 * 1024; // 28KB
const ERROR_THRESHOLD = 32 * 1024;   // 32KB (tree-sitter limit)

interface FileCheckResult {
  path: string;
  size: number;
  status: 'ok' | 'warning' | 'error';
}

interface RefactoringHint {
  pattern: string;
  suggestion: string;
}

const REFACTORING_HINTS: RefactoringHint[] = [
  {
    pattern: 'project_call_graph',
    suggestion: 'Consider splitting call graph logic into separate modules (traversal, building, analysis)'
  },
  {
    pattern: 'test',
    suggestion: 'Consider splitting large test files into focused test suites'
  },
  {
    pattern: 'index',
    suggestion: 'Consider moving exports to separate barrel files by feature'
  },
  {
    pattern: 'graph',
    suggestion: 'Consider extracting graph algorithms into separate utility modules'
  }
];

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function getRefactoringHint(filePath: string): string | undefined {
  for (const hint of REFACTORING_HINTS) {
    if (filePath.includes(hint.pattern)) {
      return hint.suggestion;
    }
  }
  return 'Consider splitting into smaller, focused modules';
}

function findFiles(dir: string, extensions: string[], ignore: string[] = []): string[] {
  const results: string[] = [];
  
  function walk(currentPath: string) {
    // Skip ignored directories
    for (const ignorePattern of ignore) {
      if (currentPath.includes(ignorePattern)) {
        return;
      }
    }
    
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }
  
  walk(dir);
  return results;
}

async function checkFileSizes(rootDir: string = '.'): Promise<{
  results: FileCheckResult[];
  hasWarnings: boolean;
  hasErrors: boolean;
}> {
  const results: FileCheckResult[] = [];
  let hasWarnings = false;
  let hasErrors = false;

  // Find all source files
  const extensions = ['.ts', '.js', '.tsx', '.jsx'];
  const ignore = ['node_modules', 'dist', 'build', '.git', 'coverage'];
  const files = findFiles(rootDir, extensions, ignore);

  for (const file of files) {
    const stats = fs.statSync(file);
    const size = stats.size;
    
    let status: 'ok' | 'warning' | 'error' = 'ok';
    if (size >= ERROR_THRESHOLD) {
      status = 'error';
      hasErrors = true;
    } else if (size >= WARNING_THRESHOLD) {
      status = 'warning';
      hasWarnings = true;
    }

    results.push({
      path: file,
      size,
      status
    });
  }

  return { results, hasWarnings, hasErrors };
}

async function main() {
  console.log('🔍 Checking file sizes...\n');

  // Check files in the packages directory
  const packagesDir = path.join(__dirname, '..', '..', '..');
  const { results, hasWarnings, hasErrors } = await checkFileSizes(path.join(packagesDir, 'packages'));

  // Sort by size descending
  results.sort((a, b) => b.size - a.size);

  // Report warnings and errors
  const problemFiles = results.filter(r => r.status !== 'ok');
  
  if (problemFiles.length === 0) {
    console.log('✅ All files are within size limits!');
    console.log(`   Checked ${results.length} files\n`);
  } else {
    console.log(`Found ${problemFiles.length} files approaching or exceeding limits:\n`);

    for (const result of problemFiles) {
      const icon = result.status === 'error' ? '❌' : '⚠️';
      const label = result.status === 'error' ? 'ERROR' : 'WARNING';
      
      console.log(`${icon} ${label}: ${result.path}`);
      console.log(`   Size: ${formatSize(result.size)} (limit: ${formatSize(ERROR_THRESHOLD)})`);
      
      if (result.status === 'error') {
        const hint = getRefactoringHint(result.path);
        console.log(`   💡 Hint: ${hint}`);
      }
      console.log();
    }
  }

  // Show top 5 largest files
  console.log('📊 Top 5 largest files:');
  const top5 = results.slice(0, 5);
  for (const result of top5) {
    const percent = ((result.size / ERROR_THRESHOLD) * 100).toFixed(0);
    console.log(`   ${formatSize(result.size)} (${percent}%) - ${result.path}`);
  }

  console.log('\nSummary:');
  console.log(`   Total files checked: ${results.length}`);
  console.log(`   Files > 28KB (warning): ${results.filter(r => r.status === 'warning').length}`);
  console.log(`   Files > 32KB (error): ${results.filter(r => r.status === 'error').length}`);

  // Exit with error code if any files exceed the limit
  if (hasErrors) {
    console.log('\n❌ File size check failed! Files exceed tree-sitter\'s 32KB limit.');
    console.log('   Please refactor large files before committing.\n');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Some files are approaching the size limit.');
    console.log('   Consider refactoring before they grow further.\n');
  } else {
    console.log('\n✅ All files are well within size limits.\n');
  }
}

// Support running as a module
export { checkFileSizes, WARNING_THRESHOLD, ERROR_THRESHOLD };

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Error checking file sizes:', err);
    process.exit(1);
  });
}