/**
 * Function call chains
 * Tests: function calling other functions, call graph detection
 */

export function main() {
  const result = process_data();
  log_result(result);
  return result;
}

function process_data() {
  const raw = fetch_data();
  const transformed = transform_data(raw);
  const validated = validate_data(transformed);
  return validated;
}

function fetch_data() {
  return { value: 42, timestamp: Date.now() };
}

function transform_data(data: any) {
  return {
    ...data,
    value: data.value * 2,
    processed: true,
  };
}

function validate_data(data: any) {
  if (data.value < 0) {
    throw new Error("Invalid value");
  }
  return data;
}

function log_result(result: any): void {
  console.log("Result:", result);
}

// Branching call chains
export function conditional_process(use_cache: boolean) {
  if (use_cache) {
    return fetch_from_cache();
  } else {
    return fetch_from_network();
  }
}

function fetch_from_cache() {
  return { source: "cache", data: [] };
}

function fetch_from_network() {
  const data = make_request();
  return { source: "network", data };
}

function make_request() {
  return [1, 2, 3];
}
