---
id: TASK-350.1
title: "[method_lookup] method_lookup: exhaust the member surface on resolved receivers and namespaces"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-350
priority: high
ordinal: 1000
plan_dedup_key: 0625f655075bb953250e838c93ba3fe72df1675d663a578963fcd8e4463fe687
plan_source_task: pt-f2aeb8bf1e95f089
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Group node for the `method_lookup` fault area. The confirmed members split into three coherent member-lookup gaps (namespace-export, constructor-member linkage, operator-method alias) plus an interim classifier mitigation. Every child carries `fault_area: method_lookup` and grounds on the confirmed-belong evidence rows.

## Observations

- Observed count: **30**
- Projects: `TypeScript`, `django`, `pandas`, `sqlalchemy`, `sqlx`
- Source runs: `3da582a-2026-06-22T15-54-41.005Z`, `7964e22-2026-06-18T18-10-41.763Z`, `897eeef-2026-06-22T11-45-34.787Z`, `aa0efc9-2026-06-18T18-25-42.253Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/django/contrib/admin/options.py:937` — Direct constructor call `ChangeList(...)` is a real caller of `ChangeList.__init__` that Ariadne's resolution pipeline failed to link. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/django/contrib/admin/views/main.py:63` — Direct constructor call `forms.CharField(required=False, strip=False)` is a confirmed real caller of `CharField.__init__` that Ariadne detected but left unresolved (resolution_count=0). (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/django/test/client.py:178` — Direct instantiation `WSGIRequest(environ)` at line 178 is a real caller of `WSGIRequest.__init__` but Ariadne failed to link it. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/django/test/client.py:235` — Direct instantiation of ASGIRequest with scope and body_file arguments, which should invoke this **init** but is not linked in Ariadne's call graph. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/admin_changelist/tests.py:665` — Direct constructor call `CookieStorage(request)` that Ariadne did not resolve to `CookieStorage.__init__`. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/asgi/tests.py:153` — Direct instantiation of ASGIStaticFilesHandler with an application argument matches the `__init__(self, application)` signature at handlers.py:90, confirming a real caller exists that Ariadne missed. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/db_functions/text/test_concat.py:23` — Direct constructor call `Concat('alias', 'goes_by')` after `from django.db.models.functions import Concat` confirms real callers exist that Ariadne did not resolve to this **init**. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/file_storage/test_inmemory_storage.py:14` — Direct constructor call `InMemoryStorage()` is a real caller of `__init__` that Ariadne's call graph failed to resolve to this definition. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/gis_tests/layermap/tests.py:79` — Direct instantiation `LayerMapping(City, city_shp, city_mapping)` calls `__init__` but Ariadne did not resolve this call site to the constructor definition at layermapping.py:97. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/gis_tests/test_geoip2.py:74` — GeoIP2() is called directly as a constructor, triggering **init**, but Ariadne did not resolve this call to the GeoIP2.**init** definition in geoip2.py. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/postgres_tests/test_search.py:504` — Direct instantiation `SearchRank(vector, SearchQuery(...))` calls `SearchRank.__init__` but Ariadne did not link this call site to the entry. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/redirects_tests/tests.py:86` — Direct instantiation of RedirectFallbackMiddleware with get_response argument calls **init** at middleware.py:15, but Ariadne did not resolve this constructor call to the **init** definition. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/staticfiles_tests/test_finders.py:72` — Direct instantiation of StaticFilesStorage via module attribute call which invokes **init** but was not linked by Ariadne's resolver. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/user_commands/tests.py:461` — Direct instantiation `BaseCommand()` calls `BaseCommand.__init__` but Ariadne did not resolve the class-instantiation call expression to the `__init__` definition. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/type_info.rs:344` — Direct `self.eq_impl(other, false)` call in the same file's impl block confirms a real caller exists that Ariadne failed to resolve. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:8638` — Direct call to getModuleSpecifiers via namespace import binding; resolution_count=0 confirms Ariadne failed to link namespace property access to the function definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/compilerImpl.ts:34` — Real caller uses `ts.readConfigFile` (namespace-qualified) with resolution_count=0, confirming Ariadne did not link this call to the definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/compilerImpl.ts:40` — Call is made as `ts.parseJsonConfigFileContent(...)` where `ts` is a namespace import (`import * as ts`), which Ariadne's resolver fails to follow. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/fourslashImpl.ts:349` — Real caller exists at this line using namespace-qualified `ts.convertCompilerOptionsFromJson` but resolution_count=0 because Ariadne does not follow namespace object member access to the exported function definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/fourslashImpl.ts:461` — Real caller exists at this line invoking getAllKeys via the `ts` namespace reference, but Ariadne's resolver failed to link it to the definition in core.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/harnessLanguageService.ts:463` — Real caller at line 463 invokes preProcessFile via the `ts` namespace alias with resolution_count=0, confirming a namespace-qualified dispatch resolution gap. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/incrementalUtils.ts:161` — Real caller exists using namespace-qualified `ts.comparePathsCaseSensitive` but Ariadne's resolver reports resolution_count=0 due to inability to resolve through the `ts` namespace alias. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/testRunner/fourslashRunner.ts:59` — Real caller invokes runFourSlashTest via a star-import namespace alias FourSlash, which Ariadne's resolver did not link to the definition in fourslashImpl.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/testRunner/unittests/config/showConfig.ts:29` — Real caller invokes getParsedCommandLineOfConfigFile via the ts namespace object with resolution_count=0, confirming Ariadne failed to link this namespace-qualified call to the definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/tsc/tsc.ts:24` — Direct invocation of executeCommandLine via `ts.*` namespace import which Ariadne fails to resolve to the definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/io/test_parquet.py:380` — Test file calls .to_parquet() on a DataFrame instance, confirming real callers exist but resolution fails to link them to the implementation at frame.py:2827. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/dialects/postgresql/provision.py:158` — Real caller assigns stmt from insert() factory then calls on_conflict_do_update on it, but resolution_count=0 because the factory return type is unknown to the resolver. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/orm/path_registry.py:815` — Class-body conditional assignment `__getitem__ = _getitem` makes `_getitem` the runtime `__getitem__` implementation, but Ariadne does not resolve this alias so subscript callers are not linked back to `_getitem`. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/orm/strategies.py:1116` — Subscripts `_current_path` (which defaults to `PathRegistry.root`, a `RootRegistry` instance) via `[rev.parent]`, triggering `__getitem__` which is aliased to `RootRegistry._getitem`. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/sql/annotation.py:480` — Call to nested function clone(element) at line 480 is within \_deep_annotate's closure where clone is defined at line 436, but Ariadne resolves the name to the subsequent variable assignment clone = None at line 481 instead. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/method_lookup.ts` so the method_lookup pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
