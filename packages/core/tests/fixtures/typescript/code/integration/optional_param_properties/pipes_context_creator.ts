// TASK-350 evidence — NestJS PipesContextCreator.
// The `private readonly applicationConfig?: ApplicationConfig` optional
// param-property is the receiver for getGlobalPipes()/getGlobalGuards(). The
// .scm fix makes the implicit field (and its type) survive indexing, so these
// calls resolve and the ApplicationConfig members are no longer entry points.
import { ApplicationConfig } from "./application_config";

export class PipesContextCreator {
  constructor(private readonly applicationConfig?: ApplicationConfig) {}

  createConcreteContext(): unknown[] {
    return this.applicationConfig?.getGlobalPipes() ?? [];
  }

  getGlobalGuards(): unknown[] {
    return this.applicationConfig?.getGlobalGuards() ?? [];
  }
}
