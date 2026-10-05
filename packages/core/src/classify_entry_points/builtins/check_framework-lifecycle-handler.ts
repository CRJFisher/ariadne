// Classifier for the known-issues registry rule `framework-lifecycle-handler`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A method invoked by a framework's lifecycle protocol with no in-source call
// site, so the resolver sees zero inbound edges and marks it unreachable. Three
// precise, framework-specific branches:
//
//   - yargs CommandModule.handler: a method named exactly `handler` in a
//     `commands/<Name>Command.ts` file. yargs invokes `.handler(args)` via the
//     CommandModule interface contract.
//   - Angular component/directive lifecycle hooks: the method name is itself the
//     Angular interface contract (ng-prefixed hook names), invoked by the
//     change-detection runtime.
//   - TypeORM entity listeners: the method name is user-chosen, so the
//     discriminant is the TypeORM lifecycle decorator directly above the
//     definition; the ORM fires these during its persistence lifecycle.
//
// Each branch is individually precise, so their union suppresses only genuine
// framework-dispatched methods. NestJS request/route/resolver/message handlers
// (`@Get`, `@Query`, `@SubscribeMessage`, ...) are a distinct routing-dispatch
// limitation and are NOT matched here — they belong to
// `framework-lifecycle-dispatch`.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { extract_decorator_block } from "./extract_decorator_block";

const ANGULAR_LIFECYCLE_HOOK =
  /^ng(OnChanges|OnInit|DoCheck|AfterContentInit|AfterContentChecked|AfterViewInit|AfterViewChecked|OnDestroy)$/;

const TYPEORM_ENTITY_LISTENER_DECORATOR =
  /^\s*@(BeforeInsert|AfterInsert|BeforeUpdate|AfterUpdate|BeforeRemove|AfterRemove|BeforeSoftRemove|AfterSoftRemove|BeforeRecover|AfterRecover|AfterLoad)\s*\(/m;

export function check_framework_lifecycle_handler(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  if (language !== "typescript") return false;

  const is_yargs_handler =
    /^handler$/.test(entry_point.name) &&
    /.*\/commands\/[A-Z][A-Za-z0-9]*Command\.(ts|js)$/.test(entry_point.file_path);

  const is_angular_lifecycle_hook = ANGULAR_LIFECYCLE_HOOK.test(entry_point.name);

  const is_typeorm_entity_listener = TYPEORM_ENTITY_LISTENER_DECORATOR.test(
    extract_decorator_block(read_file_lines(entry_point.file_path), entry_point.start_line),
  );

  return is_yargs_handler || is_angular_lifecycle_hook || is_typeorm_entity_listener;
}
