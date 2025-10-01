// Imports and exports
import { helper, util } from "./utils";
import defaultExport from "./default";

export const VERSION = "1.0.0";

export function processData(data) {
  return helper(data);
}

export class DataProcessor {
  constructor(config) {
    this.config = config;
  }

  process(data) {
    return processData(data);
  }
}

function main() {
  const processor = new DataProcessor({ mode: "strict" });
  return processor.process({ value: 42 });
}

export { main };
export default DataProcessor;
