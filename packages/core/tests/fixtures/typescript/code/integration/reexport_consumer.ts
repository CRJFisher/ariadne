import { Engine, shared } from "./reexport_barrel";
import * as barrel from "./reexport_barrel";

export function run(engine: Engine): void {
  engine.start();
  barrel.helper();
  shared.start();
}
