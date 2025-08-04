#!/usr/bin/env tsx
/**
 * CI/CD validation script for Ariadne self-analysis
 * Runs the validation test and checks results against success thresholds
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface ValidationOutput {
  meta: {
    timestamp: string;
    ariadne_version: string;
    total_files: number;
    total_functions: number;
    total_calls: number;
  };
  validation_stats: {
    nodes_with_calls_pct: number;
    nodes_called_by_others_pct: number;
    exported_nodes_pct: number;
    edges_with_call_type_pct: number;
    top_level_accuracy_pct: number;
  };
}

// Success thresholds
const THRESHOLDS = {
  top_level_accuracy_pct: 90,
  nodes_with_calls_pct: 85,
  nodes_called_by_others_pct: 85,
  edges_with_call_type_pct: 80,
  min_total_functions: 50,  // Ensure we're analyzing a reasonable amount of code
  min_total_calls: 100
};

function runValidation(): boolean {
  console.log('🚀 Running Ariadne self-analysis validation for CI/CD...\n');
  
  try {
    // Run the validation script
    console.log('📊 Running validate-ariadne.ts...');
    const validateScript = path.join(__dirname, 'validate-ariadne.ts');
    execSync(`npx tsx "${validateScript}"`, {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    // Read the output file
    const outputPath = path.join(__dirname, 'ariadne-validation-output.yaml');
    if (!fs.existsSync(outputPath)) {
      console.error('❌ Validation output file not found!');
      return false;
    }
    
    const yamlContent = fs.readFileSync(outputPath, 'utf-8');
    const output = yaml.load(yamlContent) as ValidationOutput;
    
    console.log('\n📈 Validation Results:');
    console.log('─'.repeat(50));
    
    // Check basic metrics
    const basicChecks = [
      {
        name: 'Total functions analyzed',
        value: output.meta.total_functions,
        threshold: THRESHOLDS.min_total_functions,
        check: output.meta.total_functions >= THRESHOLDS.min_total_functions
      },
      {
        name: 'Total calls detected',
        value: output.meta.total_calls,
        threshold: THRESHOLDS.min_total_calls,
        check: output.meta.total_calls >= THRESHOLDS.min_total_calls
      }
    ];
    
    // Check accuracy metrics
    const accuracyChecks = [
      {
        name: 'Top-level accuracy',
        value: output.validation_stats.top_level_accuracy_pct,
        threshold: THRESHOLDS.top_level_accuracy_pct,
        check: output.validation_stats.top_level_accuracy_pct >= THRESHOLDS.top_level_accuracy_pct
      },
      {
        name: 'Nodes with calls',
        value: output.validation_stats.nodes_with_calls_pct,
        threshold: THRESHOLDS.nodes_with_calls_pct,
        check: output.validation_stats.nodes_with_calls_pct >= THRESHOLDS.nodes_with_calls_pct
      },
      {
        name: 'Nodes called by others',
        value: output.validation_stats.nodes_called_by_others_pct,
        threshold: THRESHOLDS.nodes_called_by_others_pct,
        check: output.validation_stats.nodes_called_by_others_pct >= THRESHOLDS.nodes_called_by_others_pct
      },
      {
        name: 'Edges with call type',
        value: output.validation_stats.edges_with_call_type_pct,
        threshold: THRESHOLDS.edges_with_call_type_pct,
        check: output.validation_stats.edges_with_call_type_pct >= THRESHOLDS.edges_with_call_type_pct
      }
    ];
    
    let allChecksPassed = true;
    
    // Display basic checks
    console.log('\n📋 Basic Metrics:');
    for (const check of basicChecks) {
      const status = check.check ? '✅' : '❌';
      console.log(`  ${status} ${check.name}: ${check.value} (threshold: >= ${check.threshold})`);
      if (!check.check) allChecksPassed = false;
    }
    
    // Display accuracy checks
    console.log('\n🎯 Accuracy Metrics:');
    for (const check of accuracyChecks) {
      const status = check.check ? '✅' : '❌';
      const percentage = check.value.toFixed(1);
      console.log(`  ${status} ${check.name}: ${percentage}% (threshold: >= ${check.threshold}%)`);
      if (!check.check) allChecksPassed = false;
    }
    
    console.log('\n' + '─'.repeat(50));
    
    if (allChecksPassed) {
      console.log('✅ All validation checks PASSED!');
      console.log('\n🎉 Ariadne self-analysis meets all accuracy thresholds.');
      return true;
    } else {
      console.log('❌ Some validation checks FAILED!');
      console.log('\n⚠️  Ariadne self-analysis accuracy is below required thresholds.');
      console.log('   This could indicate regressions in the call graph extraction logic.');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
    return false;
  }
}

// Run validation and exit with appropriate code
const success = runValidation();
process.exit(success ? 0 : 1);