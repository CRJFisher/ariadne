/**
 * Interface inheritance
 * Tests: interface extending other interfaces, multiple inheritance
 */

interface Named {
  name: string;
}

interface Identifiable {
  id: number;
}

interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

// Single inheritance
interface Person extends Named {
  age: number;
  email: string;
}

// Multiple inheritance
interface Employee extends Named, Identifiable {
  department: string;
  salary: number;
}

// Chained inheritance
interface Entity extends Identifiable, Timestamped {
  version: number;
}

interface User extends Entity, Named {
  email: string;
  active: boolean;
}

export { Named, Identifiable, Timestamped, Person, Employee, Entity, User };
