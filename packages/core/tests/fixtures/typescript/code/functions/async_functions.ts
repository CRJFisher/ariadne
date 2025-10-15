/**
 * Async/await patterns
 * Tests: async functions, await expressions, Promise handling
 */

async function fetchUser(id: number): Promise<object> {
  await delay(100);
  return { id, name: "User" + id };
}

async function fetchUsers(ids: number[]): Promise<object[]> {
  const promises = ids.map((id) => fetchUser(id));
  return Promise.all(promises);
}

async function processUserData(userId: number): Promise<string> {
  const user = await fetchUser(userId);
  const processed = await transformUser(user);
  return formatUserData(processed);
}

async function transformUser(user: object): Promise<object> {
  await delay(50);
  return { ...user, transformed: true };
}

function formatUserData(user: any): string {
  return JSON.stringify(user);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Error handling with async
async function safeFetch(id: number): Promise<object | null> {
  try {
    const data = await fetchUser(id);
    return data;
  } catch (error) {
    console.error("Fetch failed:", error);
    return null;
  }
}

export { fetchUser, fetchUsers, processUserData, safeFetch };
