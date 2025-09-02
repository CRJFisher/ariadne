/**
 * Types for member access expression detection
 */

import { Location, FilePath, NamespaceName } from '@ariadnejs/types';

/**
 * Represents a member access expression in the AST
 * e.g., namespace.member, module.function, object.property
 */
export interface MemberAccessExpression {
  readonly namespace: NamespaceName;
  readonly member: string;
  readonly location: Location;
}

/**
 * Context for member access detection
 */
export interface MemberAccessContext {
  readonly file_path: FilePath;
  readonly namespace_imports: ReadonlySet<NamespaceName>;
}