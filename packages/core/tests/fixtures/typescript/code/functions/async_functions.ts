/**
 * Async/await patterns
 * Tests: async functions, await expressions, Promise handling
 */

async function fetch_user(id: number): Promise<object> {
  await delay(100);
  return { id, name: "User" + id };
}

async function fetch_users(ids: number[]): Promise<object[]> {
  const promises = ids.map((id) => fetch_user(id));
  return Promise.all(promises);
}

async function process_user_data(user_id: number): Promise<string> {
  const user = await fetch_user(user_id);
  const processed = await transform_user(user);
  return format_user_data(processed);
}

async function transform_user(user: object): Promise<object> {
  await delay(50);
  return { ...user, transformed: true };
}

function format_user_data(user: any): string {
  return JSON.stringify(user);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Error handling with async
async function safe_fetch(id: number): Promise<object | null> {
  try {
    const data = await fetch_user(id);
    return data;
  } catch (error) {
    console.error("Fetch failed:", error);
    return null;
  }
}

export { fetch_user, fetch_users, process_user_data, safe_fetch };
