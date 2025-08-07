#!/usr/bin/env npx tsx

/**
 * Feature Discovery Script
 * 
 * Scans the folder structure to understand feature support
 * No registry to maintain - the folder structure IS the registry
 */

import fs from 'fs';
import path from 'path';

const LANGUAGES = ['javascript', 'typescript', 'python', 'rust'];
const SRC_DIR = path.join(__dirname, '..', 'src');

interface FeatureInfo {
  category: string;
  feature: string;
  languages: Record<string, 'full' | 'partial' | 'none'>;
  hasReadme: boolean;
  hasTests: boolean;
}

/**
 * Scan for features based on folder structure
 */
function discoverFeatures(): FeatureInfo[] {
  const features: FeatureInfo[] = [];
  
  // Feature categories are top-level folders that contain features
  const categories = ['import_resolution', 'call_graph', 'type_system', 'scope_resolution'];
  
  for (const category of categories) {
    const categoryPath = path.join(SRC_DIR, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const featureDirs = fs.readdirSync(categoryPath)
      .filter(f => fs.statSync(path.join(categoryPath, f)).isDirectory());
    
    for (const featureName of featureDirs) {
      const featurePath = path.join(categoryPath, featureName);
      const feature: FeatureInfo = {
        category,
        feature: featureName,
        languages: {},
        hasReadme: fs.existsSync(path.join(featurePath, 'README.md')),
        hasTests: false
      };
      
      // Check which language tests exist
      for (const lang of LANGUAGES) {
        const testFile = `${featureName}.${lang}.test.ts`;
        const testPath = path.join(featurePath, testFile);
        
        if (fs.existsSync(testPath)) {
          // Could parse the test file to check if it's partial
          // For now, assume existence = full support
          feature.languages[lang] = 'full';
          feature.hasTests = true;
        } else {
          feature.languages[lang] = 'none';
        }
      }
      
      features.push(feature);
    }
  }
  
  return features;
}

/**
 * Generate a support matrix from discovered features
 */
function generateMatrix(features: FeatureInfo[]): string {
  let output = '# Feature Support Matrix\n\n';
  output += '*Generated from folder structure - no registry to maintain!*\n\n';
  
  const categories = [...new Set(features.map(f => f.category))];
  
  for (const category of categories) {
    output += `## ${category.replace(/_/g, ' ').toUpperCase()}\n\n`;
    output += '| Feature | JS | TS | Python | Rust | Docs |\n';
    output += '|---------|----|----|--------|------|------|\n';
    
    const categoryFeatures = features.filter(f => f.category === category);
    
    for (const feature of categoryFeatures) {
      const name = feature.feature.replace(/_/g, ' ');
      const js = feature.languages.javascript === 'full' ? '✅' : '❌';
      const ts = feature.languages.typescript === 'full' ? '✅' : '❌';
      const py = feature.languages.python === 'full' ? '✅' : '❌';
      const rs = feature.languages.rust === 'full' ? '✅' : '❌';
      const docs = feature.hasReadme ? '📄' : '❌';
      
      output += `| ${name} | ${js} | ${ts} | ${py} | ${rs} | ${docs} |\n`;
    }
    output += '\n';
  }
  
  // Calculate coverage
  output += '## Coverage Summary\n\n';
  for (const lang of LANGUAGES) {
    const supported = features.filter(f => f.languages[lang] === 'full').length;
    const total = features.length;
    const percentage = total > 0 ? ((supported / total) * 100).toFixed(1) : '0';
    output += `- **${lang}**: ${supported}/${total} features (${percentage}%)\n`;
  }
  
  return output;
}

// Run the discovery
const features = discoverFeatures();
const matrix = generateMatrix(features);

// Save the matrix
const outputPath = path.join(__dirname, '..', 'FEATURE_MATRIX.md');
fs.writeFileSync(outputPath, matrix);

console.log(`Found ${features.length} features`);
console.log(`Matrix saved to ${outputPath}`);

// Show what's missing
console.log('\nMissing tests:');
for (const feature of features) {
  const missing = LANGUAGES.filter(lang => feature.languages[lang] === 'none');
  if (missing.length > 0) {
    console.log(`  ${feature.category}/${feature.feature}: ${missing.join(', ')}`);
  }
}