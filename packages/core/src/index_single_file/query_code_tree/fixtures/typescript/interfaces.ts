// Interface definitions and implementations

export interface User {
  id: number;
  name: string;
  email?: string;
}

export interface Admin extends User {
  permissions: string[];
  readonly role: "admin";
}

// Generic interface
export interface Container<T> {
  value: T;
  getValue(): T;
  setValue(value: T): void;
}

// Interface with index signature
export interface StringMap {
  [key: string]: string;
}

// Class implementing interfaces
export class UserImpl implements User {
  id: number;
  name: string;
  email?: string;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

// Class implementing multiple interfaces
export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export class AdminUser implements Admin, Timestamped {
  id: number;
  name: string;
  email?: string;
  permissions: string[];
  readonly role: "admin" = "admin";
  createdAt: Date;
  updatedAt: Date;

  constructor(id: number, name: string, permissions: string[]) {
    this.id = id;
    this.name = name;
    this.permissions = permissions;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}