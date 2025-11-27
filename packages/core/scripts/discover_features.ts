#!/usr/bin/env npx tsx

/**
 * Feature Discovery Script
 * 
 * Scans the folder structure to understand feature support
 * No registry to maintain - the folder structure IS the registry
 */

import fs from "fs";
import path from "path";

const LANGUAGES = ["javascript", "typescript", "python", "rust"];
const SRC_DIR = path.join(__dirname, "..", "src");

interface FeatureInfo {
  category: string;
  feature: string;
  languages: Record<string, "full" | "partial" | "none">;
  has_readme: boolean;
  has_tests: boolean;
}

/**
 * Scan for features based on folder structure
 */
function discover_features(): FeatureInfo[] {
  const features: FeatureInfo[] = [];
  
  // Feature categories are top-level folders that contain features
  const categories = ["import_resolution", "call_graph", "type_system", "scope_resolution"];
  
  for (const category of categories) {
    const category_path = path.join(SRC_DIR, category);
    if (!fs.existsSync(category_path)) continue;
    
    const feature_dirs = fs.readdirSync(category_path)
      .filter(f => fs.statSync(path.join(category_path, f)).isDirectory());
    
    for (const feature_name of feature_dirs) {
      const feature_path = path.join(category_path, feature_name);
      const feature: FeatureInfo = {
        category,
        feature: feature_name,
        languages: {},
        has_readme: fs.existsSync(path.join(feature_path, "README.md")),
        has_tests: false
      };
      
      // Check which language tests exist
      for (const lang of LANGUAGES) {
        const test_file = `${feature_name}.${lang}.test.ts`;
        const test_path = path.join(feature_path, test_file);
        
        if (fs.existsSync(test_path)) {
          // Could parse the test file to check if it's partial
          // For now, assume existence = full support
          feature.languages[lang] = "full";
          feature.has_tests = true;
        } else {
          feature.languages[lang] = "none";
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
function generate_matrix(features: FeatureInfo[]): string {
  let output = "# Feature Support Matrix\n\n";
  output += "*Generated from folder structure - no registry to maintain!*\n\n";
  
  const categories = [...new Set(features.map(f => f.category))];
  
  for (const category of categories) {
    output += `## ${category.replace(/_/g, " ").toUpperCase()}\n\n`;
    output += "| Feature | JS | TS | Python | Rust | Docs |\n";
    output += "|---------|----|----|--------|------|------|\n";
    
    const category_features = features.filter(f => f.category === category);
    
    for (const feature of category_features) {
      const name = feature.feature.replace(/_/g, " ");
      const js = feature.languages.javascript === "full" ? "✅" : "❌";
      const ts = feature.languages.typescript === "full" ? "✅" : "❌";
      const py = feature.languages.python === "full" ? "✅" : "❌";
      const rs = feature.languages.rust === "full" ? "✅" : "❌";
      const docs = feature.has_readme ? "📄" : "❌";
      
      output += `| ${name} | ${js} | ${ts} | ${py} | ${rs} | ${docs} |\n`;
    }
    output += "\n";
  }
  
  // Calculate coverage
  output += "## Coverage Summary\n\n";
  for (const lang of LANGUAGES) {
    const supported = features.filter(f => f.languages[lang] === "full").length;
    const total = features.length;
    const percentage = total > 0 ? ((supported / total) * 100).toFixed(1) : "0";
    output += `- **${lang}**: ${supported}/${total} features (${percentage}%)\n`;
  }
  
  return output;
}

// Run the discovery
const features = discover_features();
const matrix = generate_matrix(features);

// Save the matrix
const output_path = path.join(__dirname, "..", "FEATURE_MATRIX.md");
fs.writeFileSync(output_path, matrix);

console.log(`Found ${features.length} features`);
console.log(`Matrix saved to ${output_path}`);

// Show what's missing
console.log("\nMissing tests:");
for (const feature of features) {
  const missing = LANGUAGES.filter(lang => feature.languages[lang] === "none");
  if (missing.length > 0) {
    console.log(`  ${feature.category}/${feature.feature}: ${missing.join(", ")}`);
  }
}