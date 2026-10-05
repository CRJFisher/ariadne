// TASK-350 evidence — NestJS TestingInjector.
// Exercises the accessibility-modifier-only (no `readonly`) optional
// param-property variant: `public applicationConfig?: ApplicationConfig`.
// setMocker() is reached only through this receiver.
import { ApplicationConfig } from "./application_config";

export class TestingInjector {
  constructor(public applicationConfig?: ApplicationConfig) {}

  mock(): void {
    this.applicationConfig?.setMocker();
  }
}
