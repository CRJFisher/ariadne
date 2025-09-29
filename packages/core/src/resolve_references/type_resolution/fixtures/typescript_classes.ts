// Test fixture for TypeScript class inheritance and type resolution

interface IService {
  process(data: any): void;
  status: string;
}

interface ILogger {
  log(message: string): void;
}

class BaseClass {
  protected baseProperty: string = "base";

  public baseMethod(): string {
    return this.baseProperty;
  }

  protected helperMethod(): void {
    console.log("helper");
  }
}

class DerivedClass extends BaseClass implements IService, ILogger {
  public status: string = "ready";
  private derivedProperty: number = 42;

  constructor(initial: string) {
    super();
    this.baseProperty = initial;
  }

  public process(data: any): void {
    this.log(`Processing: ${data}`);
  }

  public log(message: string): void {
    console.log(`[DerivedClass] ${message}`);
  }

  public override baseMethod(): string {
    return `Derived: ${super.baseMethod()}`;
  }

  public getDerivedValue(): number {
    return this.derivedProperty;
  }

  static staticMethod(): string {
    return "static";
  }
}

class GrandchildClass extends DerivedClass {
  private grandchildProperty: boolean = true;

  constructor() {
    super("grandchild");
  }

  public override process(data: any): void {
    super.process(data);
    console.log("Additional grandchild processing");
  }
}

// Type alias for testing
type ServiceType = IService & ILogger;
type ComplexType = BaseClass | DerivedClass | GrandchildClass;

// Generic class for testing
class GenericContainer<T> {
  private value: T;

  constructor(initial: T) {
    this.value = initial;
  }

  getValue(): T {
    return this.value;
  }

  setValue(newValue: T): void {
    this.value = newValue;
  }
}