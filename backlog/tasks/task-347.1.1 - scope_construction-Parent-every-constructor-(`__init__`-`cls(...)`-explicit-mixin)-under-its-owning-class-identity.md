---
id: TASK-347.1.1
title: "[scope_construction] Parent every constructor (`__init__` / `cls(...)` / explicit mixin) under its owning class identity"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - scope_construction
dependencies: []
parent_task_id: TASK-347.1
priority: high
ordinal: 1000
plan_dedup_key: 9d80dc260a78eada7108e4b278bf5d30a696cbf22c0fc7a5be9fa2d0f4a36471
plan_source_task: pt-9a249044feb1e768
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Fix

In `scopes/`, a `constructor` scope (and a Python `method` scope) must record the class identity it belongs to. `extract_scope_name` and `map_capture_to_scope_type` already classify constructor captures, and `find_containing_scope` already nests `__init__` positionally inside the class body — but the scope tree exposes no association a downstream resolver can use to route a statically-known `ClassName(...)` call to that class's `__init__`. The fix attaches the enclosing class symbol to the constructor scope so receiver resolution can map a class-name construction site to its `__init__` definition.

## Evidence

All confirmed members are statically-known class constructions whose `__init__` is currently orphaned from its class: direct test/site instantiations across celery backends (26,27,29,30,32,37,38,40,41,43,44,45,47,49,50,51,52) and sqlalchemy (54,55,56,59,61), the pytorch classmethod `cls(...)` construction (2), and the explicit mixin call `ColumnCollectionMixin.__init__(self, ...)` (60). Dynamic, alias-chain, and registry-keyed instantiations were excluded in the membership review — they fail in name/import resolution, not here.

## Observations

- Observed count: **24**
- Projects: `celery`, `pytorch`, `sqlalchemy`
- Source runs: `1d715bc-2026-06-22T15-11-13.691Z`, `aef7f13-2026-06-22T10-38-14.644Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_arangodb.py:23` — Direct constructor instantiation `ArangoDbBackend(app=self.app)` which calls `__init__` is not linked by the call graph. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_asynchronous.py:178` — Direct instantiation `greenletDrainer(consumer)` is a real constructor call that invokes `greenletDrainer.__init__` but is not resolved in Ariadne's call graph. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_azureblockblob.py:25` — Direct class instantiation of AzureBlockBlobBackend calls **init** implicitly, but Ariadne did not resolve this to the constructor definition at azureblockblob.py:27. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_cache.py:25` — Direct instantiation `CacheBackend(backend='memory://', app=self.app)` calls `__init__` but was not resolved by Ariadne. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_cassandra.py:36` — Test file directly instantiates CassandraBackend, which invokes this **init**, but Ariadne did not link the constructor call. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_consul.py:13` — Direct constructor call ConsulBackend(...) that Ariadne did not link to the **init** definition. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_cosmosdbsql.py:18` — Direct constructor call `CosmosDBSQLBackend(app=self.app, url=self.url)` in the test setup method is a real caller of `__init__` that Ariadne did not link. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_couchbase.py:26` — Direct class instantiation `CouchbaseBackend(app=self.app)` in test setup_method calls **init**, but Ariadne did not resolve this to CouchbaseBackend.**init**. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_couchdb.py:27` — Direct constructor call `CouchBackend(app=self.app)` invokes `CouchBackend.__init__` but Ariadne did not resolve this call to the entry under investigation. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_database.py:133` — Direct class instantiation `DatabaseBackend(self.uri, app=self.app)` implicitly calls `__init__` but Ariadne does not resolve this to the constructor definition. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_filesystem.py:30` — Direct instantiation of FilesystemBackend calls **init** but Ariadne shows zero resolved call references to this constructor. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_mongodb.py:91` — Direct instantiation `MongoBackend(app=self.app, url=self.default_url)` calls `__init__` but Ariadne does not resolve this constructor call to `MongoBackend.__init__`. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_redis.py:1553` — Direct instantiation of SentinelBackend calls **init** at line 718, but Ariadne did not resolve this call site to the entry. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_rpc.py:14` — Direct constructor call `RPCBackend(app=self.app)` that should resolve to RPCBackend.**init** at rpc.py:178 but Ariadne reports no resolved callers. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_s3.py:28` — Direct constructor call `S3Backend(app=self.app)` instantiates the class and thus invokes `S3Backend.__init__`, but Ariadne produced no resolved references to this `__init__` definition. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/events/test_snapshot.py:26` — Test directly instantiates Polaroid(self.state, app=self.app) which calls **init**, but this constructor call is absent from Ariadne's call references for this entry. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/utils/test_serialization.py:49` — Direct class instantiation call that implicitly invokes **init** but is not linked by Ariadne's resolver. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/fx/_graph_pickler.py:517` — The classmethod `reduce_helper` at line 510 calls `cls(...)` which constructs a `_TensorPickleData` instance, directly invoking the `__init__` at line 521, but Ariadne does not resolve `cls(...)` in classmethods to the class constructor. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/examples/adjacency_list/adjacency_list.py:60` — Direct constructor call `Session(engine)` is a real caller of Session.**init** at line 1518 that Ariadne failed to link. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/sql/_selectable_constructors.py:637` — This line directly constructs a TableClause instance, calling the **init** under investigation, but Ariadne failed to resolve this constructor call to the TableClause.**init** definition. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/sql/schema.py:4774` — Direct explicit mixin **init** call via ColumnCollectionMixin.**init**(self, ...) which Ariadne fails to resolve as a call to the mixin's constructor. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/test/dialect/mssql/test_engine.py:634` — Direct instantiation of MSDialect_pyodbc() implicitly calls **init** but Ariadne does not resolve class instantiation to the **init** definition. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/test/dialect/mysql/test_compiler.py:1958` — Direct constructor call to the mysql `match` class imported at line 61, which invokes `match.__init__` but is not resolved by Ariadne to this definition. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/test/ext/test_horizontal_shard.py:900` — Direct constructor call `ShardedSession(...)` which invokes `ShardedSession.__init__` at horizontal_shard.py:142, but Ariadne did not resolve this link. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/index_single_file/scopes` so the scope_construction pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
