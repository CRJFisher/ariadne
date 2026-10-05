// Visitor interfaces reached through a namespace import - output_ast.ts
// Tests: angular's `implements o.TypeVisitor` shape, where every implementer
// names the interface through `import * as o`

export interface TypeVisitor {
  visitBuiltinType(type: BuiltinType, context: unknown): unknown;
}

export interface ExpressionVisitor {
  visitLiteralExpr(ast: unknown, context: unknown): unknown;
}

export class BuiltinType {
  visitType(visitor: TypeVisitor, context: unknown): unknown {
    return visitor.visitBuiltinType(this, context);
  }
}

export class BaseVisitor {
  visitComment(): void {}
}
