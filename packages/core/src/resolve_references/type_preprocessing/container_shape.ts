/**
 * The container annotations that say what one element of the container holds,
 * and which of their type arguments that is.
 *
 * The set is closed. A generic that is not listed here says nothing about its
 * elements: `Promise<T>`, `Observable<T>` and `Emitter<T>` take one type
 * argument without holding a `T` a loop or an index read can take out. Two shapes
 * cover every entry:
 *
 * - **sequence** — `Array<T>` (and `T[]`, which parses to it), `Set<T>`,
 *   Python `list[T]`, Rust `Vec<T>`. The element is the only argument.
 * - **keyed** — `Map<K, V>`, Python `dict[K, V]`, Rust `HashMap<K, V>`, and
 *   vscode's `DisposableMap<K, V>`, which declares the same two arguments. The
 *   element is the value `V`; the key is never the element.
 *
 * Measured over vscode `src/` at `f3fa55c3`: of 226,418 annotated value
 * bindings (variables, parameters, class properties) across 8,451 files, the
 * set matches 13,429 — `Array` 12,601, `Map` 547, `Set` 263, `DisposableMap`
 * 18.
 *
 * Only a bare head matches: a container named through a qualifier
 * (`std::collections::HashMap<K, V>`) is not recognised.
 */

import type { ParsedTypeAnnotation } from "./annotation";

/** How a container's iteration relates to its element: it yields the element, or key/value entries. */
export type ContainerShape = "sequence" | "keyed";

const CONTAINER_SHAPES: ReadonlyMap<string, ContainerShape> = new Map([
  ["Array", "sequence"],
  ["Set", "sequence"],
  ["list", "sequence"],
  ["Vec", "sequence"],
  ["Map", "keyed"],
  ["dict", "keyed"],
  ["HashMap", "keyed"],
  ["DisposableMap", "keyed"],
]);

const ARGUMENT_COUNT: Readonly<Record<ContainerShape, number>> = { sequence: 1, keyed: 2 };

/**
 * The shape of the container `annotation` declares and the annotation of its
 * element, or null when the annotation is not one of the closed set.
 */
export function container_element_annotation(
  annotation: ParsedTypeAnnotation
): { readonly shape: ContainerShape; readonly element: ParsedTypeAnnotation } | null {
  if (annotation.head.length !== 1 || annotation.module_specifier !== undefined) {
    return null;
  }
  const shape = CONTAINER_SHAPES.get(annotation.head[0]);
  if (!shape || annotation.arguments.length !== ARGUMENT_COUNT[shape]) {
    return null;
  }
  return { shape, element: annotation.arguments[annotation.arguments.length - 1] };
}
