#!/usr/bin/sed -f
# Replace abbreviated capture category names with full enum names
# This preserves the full capture name including any additional parts after the entity

# Core abbreviations to full names
s/@def\./@definition./g
s/@ref\./@reference./g
s/@assign\./@assignment./g

# Invalid category names that should be references or other categories
# These patterns match @category.entity where category is not a valid SemanticCategory

# @class.X → @reference.X or @type.X depending on context
s/@class\.extends/@reference.type_reference/g
s/@class\.implements/@reference.type_reference/g
s/@class\.ref/@reference.type_reference/g
s/@class\./@type./g

# @method.X → @definition.X or @modifier.X or @reference.X depending on context
s/@method\.definition/@scope.method/g
s/@method\.static/@modifier.visibility/g
s/@method\.accessibility/@modifier.access_modifier/g
s/@method\.access/@modifier.access_modifier/g
s/@method\.readonly/@modifier.readonly_modifier/g
s/@method\.with_static/@scope.method/g
s/@method\.with_access/@scope.method/g
s/@method\.generic/@scope.method/g
s/@method\.with_return_type/@scope.method/g
s/@method\.type_params/@type.type_parameters/g
s/@method\.return_type/@type.type_annotation/g
s/@method\.instance/@reference.method_call/g
s/@method\.classmethod/@scope.method/g
s/@method\.name/@definition.method/g
s/@method\./@reference./g

# @function.X → @definition.X or @type.X depending on context
s/@function\.name/@definition.function/g
s/@function\.async/@modifier.visibility/g
s/@function\.type_params/@type.type_parameters/g
s/@function\.generic/@scope.function/g
s/@function\.with_return_type/@scope.function/g
s/@function\.return_type/@type.type_annotation/g
s/@function\./@definition./g

# @field.X → @definition.X or @modifier.X
s/@field\.definition/@definition.field/g
s/@field\.static/@modifier.visibility/g
s/@field\.readonly/@modifier.readonly_modifier/g
s/@field\.accessibility/@modifier.access_modifier/g
s/@field\.access/@modifier.access_modifier/g
s/@field\.with_static/@definition.field/g
s/@field\.with_access/@definition.field/g
s/@field\.with_readonly/@definition.field/g
s/@field\.typed/@definition.field/g
s/@field\.type/@type.type_annotation/g
s/@field\.name/@definition.field/g
s/@field\.param_property/@definition.field/g
s/@field\.value/@reference.identifier/g
s/@field\./@definition./g

# @property.X → @definition.X or @type.X or @reference.X
s/@property\.definition/@definition.property/g
s/@property\.name/@definition.property/g
s/@property\.type/@type.type_annotation/g
s/@property\.typed/@definition.property/g
s/@property\./@reference./g

# @param.X → @definition.X or @type.X
s/@param\.name/@definition.parameter/g
s/@param\.type/@type.type_annotation/g
s/@param\.typed/@definition.parameter/g
s/@param\.access/@modifier.access_modifier/g
s/@param\.readonly/@modifier.readonly_modifier/g
s/@param\.property/@definition.parameter/g
s/@param\./@definition./g

# @var.X → @definition.X or @type.X
s/@var\.name/@definition.variable/g
s/@var\.type/@type.type_annotation/g
s/@var\.typed/@definition.variable/g
s/@var\./@definition./g

# Complex constructs that need category mapping
s/@constructor_call/@reference.call/g
s/@method_call/@reference.method_call/g
s/@member_access/@reference.member_access/g
s/@static_method_call/@reference.call/g
s/@instance_method_call/@reference.method_call/g
s/@super_call/@reference.call/g
s/@subscript_access/@reference.member_access/g
s/@constructor\.definition/@scope.constructor/g
s/@constructor\./@definition./g

# Type-related captures
s/@type_alias\.definition/@definition.type_alias/g
s/@type_alias\./@type./g
s/@type_param\.definition/@definition.type_parameter/g
s/@type_param\./@type./g
s/@type_reference/@reference.type_reference/g
s/@typeof\.expr/@reference.typeof/g

# Import/Export specific - these are already mostly correct category
# Just need to fix entity names to be valid
s/@import\.source/@import.import/g
s/@import\.named/@import.import/g
s/@import\.default/@import.import/g
s/@import\.module/@import.import/g
s/@import\.star/@import.import/g
s/@import\.self/@import.import/g
s/@import\.extern_crate/@import.import/g
s/@import\.base_path/@import.import/g
s/@import\.nested_path/@import.import/g
s/@import\.wildcard/@import.import/g

s/@export\.all/@export.variable/g
s/@export\.explicit/@export.variable/g
s/@export\.named/@export.variable/g
s/@export\.default/@export.variable/g
s/@export\.declaration/@export.variable/g
s/@export\.reexport/@export.variable/g
s/@export\.pub_use/@export.variable/g
s/@export\.interface/@export.interface/g
s/@export\.type_alias/@export.type_alias/g

# Scope-related that are already correct
# (scope.X is already valid)

# Pattern matching (Rust-specific) - map to appropriate categories
s/@pattern\./@reference./g

# Control flow
s/@control_flow\./@reference./g

# Attributes, decorators, modifiers (language-specific constructs)
s/@attribute\./@decorator.class/g
s/@derive\./@decorator.class/g
s/@proc_macro\./@decorator.class/g

# Ownership and lifetimes (Rust-specific) - map to references
s/@ownership\./@reference./g
s/@lifetime\./@type./g

# Smart pointers (Rust-specific) - map to type
s/@smart_pointer\./@type./g
s/@box\./@type./g

# Implementation blocks (Rust-specific)
s/@impl\./@reference./g

# Constraints (Rust-specific)
s/@constraint\./@type./g

# Interface (TypeScript/Rust trait) - map to appropriate categories
s/@interface\.definition/@definition.interface/g
s/@interface\.name/@definition.interface/g
s/@interface\.generic/@scope.interface/g
s/@interface\.type_params/@type.type_parameters/g
s/@interface\./@definition./g

# Enum
s/@enum\.definition/@definition.enum/g
s/@enum\.member/@definition.enum_member/g
s/@enum\./@definition./g

# Namespace
s/@namespace\.definition/@definition.namespace/g
s/@namespace\./@import./g

# Module
s/@module\./@definition./g

# Instance/arrow/async/match/visibility - context-specific, map to references or modifiers
s/@instance\./@reference./g
s/@arrow\./@definition./g
s/@async\./@modifier./g
s/@match\./@reference./g
s/@visibility\./@modifier./g

# Return statements
s/@return\.statement/@return.function/g
s/@return\./@return./g

# Yield expressions
s/@yield\./@return./g

# Macro calls
s/@macro\./@reference.macro/g

# Assignment expressions (already has correct category)
# assignment.X is valid

# Catch-all for any remaining invalid patterns
# If we missed something, the validation will catch it