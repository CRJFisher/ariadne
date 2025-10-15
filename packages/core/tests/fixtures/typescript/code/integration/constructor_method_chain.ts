/**
 * Constructor → type → method chain
 * Tests: constructor call, type binding, method call chain
 */

class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  getName(): string {
    return this.name;
  }

  getEmail(): string {
    return this.email;
  }
}

// Constructor call creates instance with type binding
const user = new User("Alice", "alice@example.com");

// Method call on constructed instance
const userName = user.getName();
const userEmail = user.getEmail();

export { User, user, userName, userEmail };