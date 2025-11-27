/**
 * Constructor → type → method chain
 * Tests: constructor call, type binding, method call chain
 */

class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  get_name(): string {
    return this.name;
  }

  get_email(): string {
    return this.email;
  }
}

// Constructor call creates instance with type binding
const user = new User("Alice", "alice@example.com");

// Method call on constructed instance
const user_name = user.get_name();
const user_email = user.get_email();

export { User, user, user_name, user_email };