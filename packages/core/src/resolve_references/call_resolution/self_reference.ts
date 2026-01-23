/**
 * Self-Reference Call Resolution
 *
 * Resolves calls on self-reference keywords (this, self, super, cls) by:
 * 1. Finding the containing class scope
 * 2. Looking up the method in that class scope
 * 3. For super calls, finding the parent class first
 *
 * Integration points:
 * - Uses ScopeRegistry for scope tree walking
 * - Uses DefinitionRegistry for class and method lookups
 * - Direct O(1) lookups using pre-built indexes
 *
 * Example resolution flow:
 * ```
 * class Builder {
 *   process() {
 *     this.build_class(node);  // ← Resolve this
 *   }
 *   build_class(node) { }
 * }
 * ```
 *
 * Steps:
 * 1. Reference scope is "process" method scope
 * 2. Walk up scope tree to find "Builder" class scope
 * 3. Look up "build_class" in Builder class scope
 * 4. Return build_class method symbol_id
 */








