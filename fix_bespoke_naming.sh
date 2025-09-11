#!/bin/bash

# Phase 1: Fix .bespoke suffix violations only (safe renames)
# Leave .generic conflicts for manual resolution

set -e

echo "🔧 Fixing .bespoke file naming conventions..."

# Function to rename file and update imports
rename_file() {
    local old_path="$1"
    local new_path="$2"
    local old_import_name=$(basename "$old_path" .ts)
    local new_import_name=$(basename "$new_path" .ts)
    
    if [ -f "$old_path" ]; then
        echo "📝 Renaming: $old_path → $new_path"
        mv "$old_path" "$new_path"
        
        # Update imports across the codebase - more comprehensive patterns
        echo "🔄 Updating imports from '$old_import_name' to '$new_import_name'"
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from '\\.\\/${old_import_name}'|from './${new_import_name}'|g" {} \;
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from \"\\.\\/${old_import_name}\"|from \"./${new_import_name}\"|g" {} \;
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from '\\.\\.\\/${old_import_name}'|from '../${new_import_name}'|g" {} \;
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from \"\\.\\.\\/${old_import_name}\"|from \"../${new_import_name}\"|g" {} \;
        
        # Handle import * patterns
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from '\\.\\/${old_import_name}';|from './${new_import_name}';|g" {} \;
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from \"\\.\\/${old_import_name}\";|from \"./${new_import_name}\";|g" {} \;
    else
        echo "⚠️  File not found: $old_path"
    fi
}

echo "🚀 Removing .bespoke suffixes from language-specific files"

# Export Detection module
rename_file "packages/core/src/import_export/export_detection/export_detection.javascript.bespoke.ts" "packages/core/src/import_export/export_detection/export_detection.javascript.ts"
rename_file "packages/core/src/import_export/export_detection/export_detection.typescript.bespoke.ts" "packages/core/src/import_export/export_detection/export_detection.typescript.ts"
rename_file "packages/core/src/import_export/export_detection/export_detection.python.bespoke.ts" "packages/core/src/import_export/export_detection/export_detection.python.ts"
rename_file "packages/core/src/import_export/export_detection/export_detection.rust.bespoke.ts" "packages/core/src/import_export/export_detection/export_detection.rust.ts"

# Import Resolution module
rename_file "packages/core/src/import_export/import_resolution/import_resolution.javascript.bespoke.ts" "packages/core/src/import_export/import_resolution/import_resolution.javascript.ts"
rename_file "packages/core/src/import_export/import_resolution/import_resolution.typescript.bespoke.ts" "packages/core/src/import_export/import_resolution/import_resolution.typescript.ts"
rename_file "packages/core/src/import_export/import_resolution/import_resolution.python.bespoke.ts" "packages/core/src/import_export/import_resolution/import_resolution.python.ts"
rename_file "packages/core/src/import_export/import_resolution/import_resolution.rust.bespoke.ts" "packages/core/src/import_export/import_resolution/import_resolution.rust.ts"

# Namespace Resolution module
rename_file "packages/core/src/import_export/namespace_resolution/namespace_resolution.javascript.bespoke.ts" "packages/core/src/import_export/namespace_resolution/namespace_resolution.javascript.ts"
rename_file "packages/core/src/import_export/namespace_resolution/namespace_resolution.typescript.bespoke.ts" "packages/core/src/import_export/namespace_resolution/namespace_resolution.typescript.ts"
rename_file "packages/core/src/import_export/namespace_resolution/namespace_resolution.python.bespoke.ts" "packages/core/src/import_export/namespace_resolution/namespace_resolution.python.ts"
rename_file "packages/core/src/import_export/namespace_resolution/namespace_resolution.rust.bespoke.ts" "packages/core/src/import_export/namespace_resolution/namespace_resolution.rust.ts"

# Class Detection module (no conflicts)
rename_file "packages/core/src/inheritance/class_detection/class_detection.javascript.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.javascript.ts"
rename_file "packages/core/src/inheritance/class_detection/class_detection.typescript.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.typescript.ts"
rename_file "packages/core/src/inheritance/class_detection/class_detection.python.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.python.ts"
rename_file "packages/core/src/inheritance/class_detection/class_detection.rust.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.rust.ts"

# Class Hierarchy module (no conflicts)
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.javascript.bespoke.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.javascript.ts"
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.python.bespoke.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.python.ts"
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.rust.bespoke.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.rust.ts"

# Interface Implementation module (no conflicts)
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.typescript.bespoke.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.typescript.ts"
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.python.bespoke.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.python.ts"
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.rust.bespoke.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.rust.ts"

# Method Override module
rename_file "packages/core/src/inheritance/method_override/method_override.javascript.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.javascript.ts"
rename_file "packages/core/src/inheritance/method_override/method_override.typescript.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.typescript.ts"
rename_file "packages/core/src/inheritance/method_override/method_override.python.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.python.ts"
rename_file "packages/core/src/inheritance/method_override/method_override.rust.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.rust.ts"

# Scope Tree module (no conflicts)
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.javascript.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.javascript.ts"
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.typescript.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.typescript.ts"
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.python.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.python.ts"
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.rust.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.rust.ts"

# Symbol Resolution module (no conflicts)
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.javascript.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.javascript.ts"
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.typescript.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.typescript.ts"
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.python.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.python.ts"
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.rust.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.rust.ts"

# Return Type Inference module (no conflicts)
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.javascript.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.javascript.ts"
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.typescript.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.typescript.ts"
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.python.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.python.ts"
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.rust.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.rust.ts"

# Type Tracking module (no conflicts)
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.javascript.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.javascript.ts"
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.typescript.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.typescript.ts"
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.python.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.python.ts"
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.rust.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.rust.ts"

echo "🚀 Handling .generic renames for non-conflicting modules"

# Only rename .generic files that don't conflict
rename_file "packages/core/src/inheritance/class_detection/class_detection.generic.ts" "packages/core/src/inheritance/class_detection/class_detection.ts"
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.generic.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.ts"
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.generic.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.ts"
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.generic.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.ts"

echo "⚠️  REMAINING CONFLICTS (need manual resolution):"
echo "   - namespace_resolution: .generic.ts conflicts with .ts"
echo "   - import_resolution: .generic.ts conflicts with .ts"
echo "   - export_detection: .generic.ts conflicts with .ts"
echo "   - method_override: .generic.ts conflicts with .ts"
echo ""
echo "   These need orchestrator logic merged into generic files"

echo "✅ Phase 1 complete! Most .bespoke suffixes removed."
echo "🔍 Running quick test to verify imports..."

# Test if any imports are broken
if npm run build &>/dev/null; then
    echo "✅ Build successful - imports are working"
else
    echo "⚠️  Build failed - some imports may need manual fixes"
fi