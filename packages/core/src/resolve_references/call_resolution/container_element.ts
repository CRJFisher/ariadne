/**
 * The type one element read out of a container binding holds.
 *
 * A container binding's element is recorded once, by the `TypeRegistry`: from
 * the constructions its sequence literal holds, or from its annotation's
 * element argument (`Suite[]`, `Map<string, IEditorContribution>`). Where
 * neither describes it, the element expressions of its sequence literal
 * (`var suites = [suite]`) each name a binding whose own recorded type is the
 * element. Either way the element is one type, never a union.
 *
 * What a read yields depends on the container's shape. An index or `get(k)`
 * read yields the element of either shape; iterating a sequence yields its
 * elements, but iterating a keyed container yields entries (JavaScript `Map`,
 * Rust `HashMap`) or keys (Python `dict`), so only its values or an entry's
 * value half is the element.
 */

import type { IterationPart, SymbolId } from "@ariadnejs/types";
import type { ContainerShape } from "../type_preprocessing";
import type { ReceiverResolutionContext } from "./receiver_resolution";

/** How a binding reads its container: by index or key, or by one part of iterating it. */
export type ElementRead = "index" | IterationPart;

/**
 * The type an element `read` out of `container_id` holds, or null when the
 * container's element is unknown or the read does not yield an element.
 */
export function resolve_element_type(
  container_id: SymbolId,
  read: ElementRead,
  context: ReceiverResolutionContext
): SymbolId | null {
  const recorded = context.types.get_container_element(container_id);
  if (recorded) {
    return reads_element(recorded.shape, read) ? recorded.element : null;
  }
  return reads_element("sequence", read) ? literal_element_type(container_id, context) : null;
}

function reads_element(shape: ContainerShape, read: ElementRead): boolean {
  switch (read) {
    case "index":
    case "value":
      return true;
    case "item":
      return shape === "sequence";
    case "entry_value":
      return shape === "keyed";
  }
}

/**
 * The one type every element of a container's array literal holds, each
 * element a binding named in the literal and typed in its own right. A literal
 * holding anything but names (`[new Suite(), layer]`), an untyped element, or
 * two elements of different types leave the element unknown.
 */
function literal_element_type(
  container_id: SymbolId,
  context: ReceiverResolutionContext
): SymbolId | null {
  const collection = context.definitions.get_function_collection(container_id);
  const container_def = context.definitions.get(container_id);
  if (
    !collection ||
    !container_def ||
    collection.collection_type !== "Array" ||
    !collection.elements_are_references ||
    !collection.stored_references?.length
  ) {
    return null;
  }

  let element_id: SymbolId | null = null;
  for (const element_name of collection.stored_references) {
    const element_binding = context.resolutions.resolve(
      container_def.defining_scope_id,
      element_name
    );
    const element_type = element_binding ? context.types.get_symbol_type(element_binding) : null;
    if (!element_type || (element_id && element_id !== element_type)) {
      return null;
    }
    element_id = element_type;
  }
  return element_id;
}
