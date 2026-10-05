# Registry `wip` rules and the task that removes each pattern

`reconcile-registry` flips a `wip` rule to `fixed` when a fix commit's scope matches the rule's `backlog_task`. `registry.json` has a single writer (`reconcile_registry.ts`), so this table is for a person to apply through it.

| group_id | backlog_task | Note |
| --- | --- | --- |
| `dispatch-table-value-registration` | `TASK-368` | Python dict-value dispatch only; TASK-367 covers the JS/TS nested-literal half but the field takes one task. Neither resolves a computed key. |
| `rust-macro-registration-table` | `TASK-401` | New. TASK-400 indexes `cfg_*!` bodies for definitions, not function paths in registration tables. |
| `py-functional-property-accessor` | `TASK-402` | New. |
| `registration-decorator-dispatch` | `TASK-403` | New. May end as a `permanent` reclassification. |
| `callback-passed-to-invoker` | `TASK-404` | New. |
