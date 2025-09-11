#!/bin/bash

# Fix file naming conventions according to folder-structure-migration.md
# Remove .bespoke and .generic suffixes

set -e

echo "🔧 Fixing file naming conventions..."

# Function to rename file and update imports
rename_file() {
    local old_path="$1"
    local new_path="$2"
    local old_import_name=$(basename "$old_path" .ts)
    local new_import_name=$(basename "$new_path" .ts)
    
    if [ -f "$old_path" ]; then
        echo "📝 Renaming: $old_path → $new_path"
        mv "$old_path" "$new_path"
        
        # Update imports across the codebase
        echo "🔄 Updating imports from '$old_import_name' to '$new_import_name'"
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from '\\.\\/${old_import_name}'|from './${new_import_name}'|g" {} \;
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from \"\\.\\./${old_import_name}\"|from \"./${new_import_name}\"|g" {} \;
        find packages/core/src -name "*.ts" -exec sed -i '' "s|from '\\.\\.\\/${old_import_name}'|from '../${new_import_name}'|g" {} \;
    fi
}

echo "🚀 Phase 1: Remove .bespoke suffixes"

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

# Class Detection module
rename_file "packages/core/src/inheritance/class_detection/class_detection.javascript.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.javascript.ts"
rename_file "packages/core/src/inheritance/class_detection/class_detection.typescript.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.typescript.ts"
rename_file "packages/core/src/inheritance/class_detection/class_detection.python.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.python.ts"
rename_file "packages/core/src/inheritance/class_detection/class_detection.rust.bespoke.ts" "packages/core/src/inheritance/class_detection/class_detection.rust.ts"

# Class Hierarchy module
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.javascript.bespoke.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.javascript.ts"
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.python.bespoke.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.python.ts"
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.rust.bespoke.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.rust.ts"

# Interface Implementation module
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.typescript.bespoke.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.typescript.ts"
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.python.bespoke.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.python.ts"
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.rust.bespoke.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.rust.ts"

# Method Override module
rename_file "packages/core/src/inheritance/method_override/method_override.javascript.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.javascript.ts"
rename_file "packages/core/src/inheritance/method_override/method_override.typescript.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.typescript.ts"
rename_file "packages/core/src/inheritance/method_override/method_override.python.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.python.ts"
rename_file "packages/core/src/inheritance/method_override/method_override.rust.bespoke.ts" "packages/core/src/inheritance/method_override/method_override.rust.ts"

# Scope Tree module
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.javascript.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.javascript.ts"
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.typescript.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.typescript.ts"
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.python.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.python.ts"
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.rust.bespoke.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.rust.ts"

# Symbol Resolution module
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.javascript.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.javascript.ts"
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.typescript.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.typescript.ts"
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.python.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.python.ts"
rename_file "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.rust.bespoke.ts" "packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.rust.ts"

# Return Type Inference module
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.javascript.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.javascript.ts"
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.typescript.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.typescript.ts"
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.python.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.python.ts"
rename_file "packages/core/src/type_analysis/return_type_inference/return_type_inference.rust.bespoke.ts" "packages/core/src/type_analysis/return_type_inference/return_type_inference.rust.ts"

# Type Tracking module
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.javascript.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.javascript.ts"
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.typescript.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.typescript.ts"
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.python.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.python.ts"
rename_file "packages/core/src/type_analysis/type_tracking/type_tracking.rust.bespoke.ts" "packages/core/src/type_analysis/type_tracking/type_tracking.rust.ts"

echo "🚀 Phase 2: Remove .generic suffixes"

# Import Resolution generic
rename_file "packages/core/src/import_export/import_resolution/import_resolution.generic.ts" "packages/core/src/import_export/import_resolution/import_resolution.ts"

# Export Detection generic
rename_file "packages/core/src/import_export/export_detection/export_detection.generic.ts" "packages/core/src/import_export/export_detection/export_detection.ts"

# Namespace Resolution generic
rename_file "packages/core/src/import_export/namespace_resolution/namespace_resolution.generic.ts" "packages/core/src/import_export/namespace_resolution/namespace_resolution.ts"

# Class Detection generic
rename_file "packages/core/src/inheritance/class_detection/class_detection.generic.ts" "packages/core/src/inheritance/class_detection/class_detection.ts"

# Class Hierarchy generic
rename_file "packages/core/src/inheritance/class_hierarchy/class_hierarchy.generic.ts" "packages/core/src/inheritance/class_hierarchy/class_hierarchy.ts"

# Interface Implementation generic
rename_file "packages/core/src/inheritance/interface_implementation/interface_implementation.generic.ts" "packages/core/src/inheritance/interface_implementation/interface_implementation.ts"

# Method Override generic
rename_file "packages/core/src/inheritance/method_override/method_override.generic.ts" "packages/core/src/inheritance/method_override/method_override.ts"

# Scope Tree generic
rename_file "packages/core/src/scope_analysis/scope_tree/scope_tree.generic.ts" "packages/core/src/scope_analysis/scope_tree/scope_tree.ts"

echo "✅ File renaming complete!"
echo "🔍 Running tests to verify changes..."

# Run tests to make sure nothing is broken
npm test 2>/dev/null || echo "⚠️  Some tests failing - imports may need manual fixes"

echo "✅ Naming convention fixes complete!"