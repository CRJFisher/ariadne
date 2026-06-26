// TASK-350 evidence — Prisma MergedExtensionsList.
// Recursive self-call shape: the optional param-property `previous` is typed as
// the class itself, so `this.previous?.getAllComputedFields()` resolves to the
// same class's member. Without the field's type, the recursive call is
// unresolved and the members look like entry points.
export class MergedExtensionsList {
  constructor(private readonly previous?: MergedExtensionsList) {}

  getAllComputedFields(): unknown[] {
    return this.previous?.getAllComputedFields() ?? [];
  }

  getAllQueryCallbacks(): unknown[] {
    return this.previous?.getAllQueryCallbacks() ?? [];
  }
}
