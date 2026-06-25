---
id: TASK-350.1.1
title: "[method_lookup] Bridge direct constructor calls into the class member index so __init__ links"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-350.1
priority: high
ordinal: 1000
plan_dedup_key: 3c35d3b73fc0ea178211968c83cb913d0d9bb8fd46ab216cd4dd8826aa3c3738
plan_source_task: pt-2d58e8d114c05834
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Members

Direct instantiations (`LayerMapping(...)`, `ChangeList(...)`, `WSGIRequest(...)`, `BaseCommand()`, `InMemoryStorage()`, `SearchRank(...)`, `ASGIStaticFilesHandler(...)`, `GeoIP2()`, `CookieStorage(...)`, StaticFilesStorage via module attribute, `CharField(...)`, `ASGIRequest(...)`, RedirectFallbackMiddleware, `Concat(...)`) where the class symbol IS resolvable but the constructor call site is left with zero resolved callers.

## Fix

`extract_type_members` (type_preprocessing/member.ts lines 73-82) keeps the constructor as a **separate `constructor` field** on `TypeMemberInfo` — it is never folded into the name-keyed member map; and `definition.ts`'s `flat_members` builder (which backs `member_index`) registers the constructor only in `by_symbol`/`location_to_symbol`, never in `flat_members`. So the constructor is absent from the member surface `resolve_method_on_type` falls back to, which is why `__init__` shows zero callers. `resolve_constructor_call` (call_resolution/constructor.ts) does resolve the class. The fix has two halves: (1) key the constructor into the member surface under its language-specific runtime name (`__init__`/`constructor`/`new`) so `resolve_method_on_type` finds it; (2) a direct instantiation whose class resolves but whose `find_constructor_in_class_hierarchy` returns no constructor must fall back to that member-index entry (and to the class symbol itself when no explicit `__init__` exists anywhere). This connects the `__init__` definition as a caller target. See the unified plan in `backlog/docs/TASK-350-method-lookup-member-surface-refactor.md` (WS1 + WS5).

The Python `constructor` member kind is the common case here; the same path applies to TypeScript/Rust constructors.

## Observations

- Observed count: **14**
- Projects: `django`
- Source runs: `aa0efc9-2026-06-18T18-25-42.253Z`

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

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/method_lookup.ts` so the method_lookup pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
