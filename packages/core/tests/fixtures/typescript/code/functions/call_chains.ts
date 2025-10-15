/**
 * Function call chains
 * Tests: function calling other functions, call graph detection
 */

export function main() {
  const result = processData();
  logResult(result);
  return result;
}

function processData() {
  const raw = fetchData();
  const transformed = transformData(raw);
  const validated = validateData(transformed);
  return validated;
}

function fetchData() {
  return { value: 42, timestamp: Date.now() };
}

function transformData(data: any) {
  return {
    ...data,
    value: data.value * 2,
    processed: true,
  };
}

function validateData(data: any) {
  if (data.value < 0) {
    throw new Error("Invalid value");
  }
  return data;
}

function logResult(result: any): void {
  console.log("Result:", result);
}

// Branching call chains
export function conditionalProcess(useCache: boolean) {
  if (useCache) {
    return fetchFromCache();
  } else {
    return fetchFromNetwork();
  }
}

function fetchFromCache() {
  return { source: "cache", data: [] };
}

function fetchFromNetwork() {
  const data = makeRequest();
  return { source: "network", data };
}

function makeRequest() {
  return [1, 2, 3];
}
