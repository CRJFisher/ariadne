// Construction and initialiser shapes - services.ts

class Logger {
  log(): void {}
}

class Cache {
  clear(): void {}
}

class Info {
  describe(): void {}
}

class Registry {
  getInfo(): Info {
    return new Info();
  }
}

export class Service {
  private logger = new Logger();
  cache: Cache;
  registry: Registry;

  constructor() {
    this.cache = new Cache();
    this.registry = new Registry();
  }

  reset(): void {
    this.logger.log();
    this.cache.clear();
  }

  report(): void {
    const info = this.registry.getInfo();
    info.describe();
  }
}

export function report(registry: Registry): void {
  const info = registry.getInfo();
  info.describe();
}
