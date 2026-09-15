// The interface a caller dispatches through - shape.ts
// Tests: the order-independence matrix — interface, implementer and caller
// resolve the same whichever arrives first

export interface Shape {
  area(): number;
}
