// A dispatch through the undeclared interface - via_widget.ts
// Tests: this is the call that makes the project infer `Impl` as a structural
// subtype of `Widget`.

import { Widget } from "./contract";

export function use_widget(widget: Widget): void {
  widget.show();
}
