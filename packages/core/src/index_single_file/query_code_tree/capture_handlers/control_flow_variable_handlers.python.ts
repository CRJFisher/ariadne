/**
 * Python loop and comprehension variable handlers
 *
 * Handlers for the binding constructs that introduce a variable bound to the
 * scope they open: `for` loops, comprehensions, `except ... as`, and
 * `with ... as`. Each binds a non-exported variable; the `except` binding is
 * typed `Exception`.
 */

import type { SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import { create_variable_id } from "../symbol_factories/symbol_factories.python";

export function handle_definition_loop_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  builder.add_variable({
    kind: "variable",
    symbol_id: create_variable_id(capture),
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false,
    type: undefined,
    initial_value: undefined,
  });
}

export function handle_definition_loop_var_multiple(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  builder.add_variable({
    kind: "variable",
    symbol_id: create_variable_id(capture),
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false,
    type: undefined,
    initial_value: undefined,
  });
}

export function handle_definition_comprehension_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  builder.add_variable({
    kind: "variable",
    symbol_id: create_variable_id(capture),
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false,
    type: undefined,
    initial_value: undefined,
  });
}

export function handle_definition_except_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  builder.add_variable({
    kind: "variable",
    symbol_id: create_variable_id(capture),
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false,
    type: "Exception" as SymbolName,
    initial_value: undefined,
  });
}

export function handle_definition_with_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  builder.add_variable({
    kind: "variable",
    symbol_id: create_variable_id(capture),
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false,
    type: undefined,
    initial_value: undefined,
  });
}
