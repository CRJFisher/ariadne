// compiler/src/output/abstract_emitter.ts shape - abstract_emitter.ts

import * as o from "./output_ast";

export abstract class AbstractEmitterVisitor extends o.BaseVisitor implements o.TypeVisitor {
  visitBuiltinType(type: o.BuiltinType, context: unknown): unknown {
    super.visitComment();
    return type;
  }
}
