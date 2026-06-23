---
id: TASK-348.1.1
title: "[name_resolution] Bind the terminal name of intra-module qualified paths (Type::new, module::fn, class-static dispatch) in the scope-walk"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-348.1
priority: high
ordinal: 1000
plan_dedup_key: e983b2e86a74354cebc10d4ccc76a25b65f516318c438a86a61ebee7c5da7a81
plan_source_task: pt-908261da97472d8f
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Phase-1 binds bare `SymbolName`s into the scope map, but intra-crate/intra-module qualified call paths (`Parker::new`, `worker::create`, `wheel::Wheel::new`, `SessionToken::generate`, `types::repr_nullable_ptr`, the static `LanguageServiceTestEnv.setup()`) never produce a binding for their terminal name against the in-scope type/module, so call resolution sees `resolution_count=0`.

Extend `resolve_scope_recursive` (or a sibling pass it feeds) so that, when a reference is a qualified path whose leading segment names an in-scope type, module, submodule, type-alias, or module-alias already in the scope map, the terminal segment is bound to the corresponding member/definition `SymbolId`. This is the dominant sub-pattern (57 members, Rust-heavy, plus TS class-static dispatch).

## Observations

- Observed count: **56**
- Projects: `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, `angular`, `serde`, `sqlx`, `tokio`
- Source runs: `3da582a-2026-06-22T15-54-41.005Z`, `66e2912-2026-06-22T15-23-50.566Z`, `942ac9c-2026-06-22T19-29-32.970Z`, `a849b6f-2026-06-18T18-33-13.102Z`, `dd682c2-2026-06-22T15-32-43.992Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/angular--angular/packages/language-service/test/diagnostic_spec.ts:18` — Direct static method call `LanguageServiceTestEnv.setup()` with resolution_count=0 in Ariadne, confirming the resolver does not follow class-name receivers for static dispatch. (project `angular`, run `a849b6f-2026-06-18T18-33-13.102Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/examples/postgres/axum-social-with-tests/src/http/user.rs:78` — This line calls `crate::password::verify` with a module-qualified path, confirming a real caller exists but was not resolved by Ariadne. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/examples/postgres/multi-database/accounts/src/lib.rs:225` — Direct caller of the flagged `generate` method via qualified Rust associated-function syntax `SessionToken::generate()` in the same file, which Ariadne's resolution did not link. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/examples/postgres/multi-tenant/accounts/src/lib.rs:215` — Same-file caller invokes `SessionToken::generate()` as a type-qualified associated function call, which Ariadne failed to resolve to the impl at line 277. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-macros-core/src/derives/mod.rs:20` — Direct function call to expand_derive_type at line 20, imported via raw-identifier module path `r#type` at line 9, which Ariadne cannot resolve. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_lint/src/foreign_modules.rs:379` — Direct call via module-qualified path `types::repr_nullable_ptr(...)` that grep confirms but Ariadne does not resolve to the definition. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/serde-rs--serde/serde_derive/src/de/enum_externally.rs:172` — Direct free-function call to unwrap_to_variant_closure with resolution_count=0 despite being indexed, confirming Ariadne detected but could not resolve the cross-file call. (project `serde`, run `dd682c2-2026-06-22T15-32-43.992Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/serde-rs--serde/serde_derive/src/de/enum_internally.rs:81` — Child submodule calls `effective_style` from its parent module `de.rs` at line 841, but Ariadne cannot follow parent-module function references from child module files, leaving this call unresolved. (project `serde`, run `dd682c2-2026-06-22T15-32-43.992Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/serde-rs--serde/serde_derive/src/de/struct_.rs:459` — Direct function call to deserialize_seq_in_place from a submodule file, with resolution_count=0 indicating Ariadne detected but could not link the call to its definition in the parent module file de.rs. (project `serde`, run `dd682c2-2026-06-22T15-32-43.992Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/serde-rs--serde/serde_derive/src/de/tuple.rs:68` — Direct function call to `deserialize_seq` imported from parent module `crate::de` with resolution_count=0, confirming Ariadne cannot resolve the parent-module import path. (project `serde`, run `dd682c2-2026-06-22T15-32-43.992Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/examples/chat.rs:189` — Direct call to `LinesCodec::new()` with the type fully qualified, demonstrating a real caller that was not linked by Ariadne's resolution phase. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/examples/chat.rs:202` — Direct call `Peer::new(state.clone(), lines)` in the same file calls the method under investigation but Ariadne's call graph has no resolved reference linking it. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/examples/chat.rs:71` — Direct call `Shared::new()` in the same file as the definition, but not linked in Ariadne's call graph. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-macros/src/entry.rs:351` — Direct call `Configuration::new(is_test, rt_multi_thread)` in the same file at line 351 is a real caller that Ariadne failed to resolve to the method definition at line 87. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-stream/src/stream_ext/timeout.rs:65` — Direct intra-file call `Elapsed::new()` at line 65 is a real caller of the `new` method defined at line 90, but Ariadne did not resolve it. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-stream/src/wrappers/broadcast.rs:100` — Self::new(recv) in the From<Receiver<T>> impl is a direct intra-file call to BroadcastStream::new that Ariadne left unresolved. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-test/src/io.rs:146` — build_with_handle() at line 146 calls Inner::new() directly in the same file, proving a real caller exists. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-test/src/task.rs:161` — MockTask::new() calls ThreadWaker::new() via fully-qualified struct syntax in the same file, but Ariadne did not link this call to the ThreadWaker::new definition at line 208. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-test/src/task.rs:44` — Direct type-qualified call `MockTask::new()` within the same file is the real caller, but Ariadne did not resolve it to the definition at line 159. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/codec/length_delimited.rs:479` — LengthDelimitedCodec::builder() calls Builder::new() directly in the same file, confirming a real caller exists that Ariadne did not resolve to this definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/sync/cancellation_token.rs:161` — Direct caller using module-qualified path `tree_node::TreeNode::new()` that Ariadne failed to resolve to the TreeNode::new definition in tree_node.rs (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/sync/mpsc.rs:116` — PollSender::new() at line 112 calls PollSenderFuture::new() at line 116, which is the entry under investigation — a real intra-file caller that Ariadne's resolver missed. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/time/delay_queue.rs:192` — KeyInternal::new is called directly in the same file at least 4 times with qualified path syntax, confirming real callers exist that Ariadne's resolver missed. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/time/delay_queue.rs:252` — Key::new is called at line 252 within the same file as its definition, confirming it has real callers that Ariadne's resolver missed. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/time/wheel/mod.rs:62` — Level::new is passed as a function-path argument to .map(), not invoked directly, so Ariadne emits no call reference linking this site to Level::new. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/tests/codecs.rs:236` — Direct type-qualified call `AnyDelimiterCodec::new(...)` in test file is a real caller that Ariadne failed to resolve to the definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/tests/codecs.rs:9` — Real caller using qualified `BytesCodec::new()` not linked by Ariadne's resolver despite being in the indexed codebase. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/tests/framed.rs:102` — Direct qualified call `FramedParts::new(...)` that Ariadne indexed but did not resolve to the `FramedParts<T,U>::new` impl at framed.rs:380. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/tests/length_delimited.rs:75` — Explicit type-qualified call `LengthDelimitedCodec::new()` is a real caller that Ariadne failed to link to the definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/tests/mpsc.rs:13` — Direct call to PollSender::new(send) demonstrates a real, type-qualified caller that Ariadne failed to link to the impl method. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/tests/spawn_pinned.rs:12` — Calls `task::LocalPoolHandle::new(1)` which is a real caller of the investigated method but was not resolved by Ariadne. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/tests/sync_cancellation_token.rs:16` — Grep confirms `CancellationToken::new()` is called here but Ariadne's call refs show zero resolved callers for this definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/io/stdio_common.rs:202` — LoggingMockWriter::new() is called at line 202 within the same #[cfg(test)] module where it is defined at line 149, confirming a real intra-file caller that Ariadne did not resolve. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/blocking/mod.rs:25` — Direct type-qualified call `BlockingPool::new(builder, thread_cap)` is the sole real caller and was indexed but not resolved to this definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/builder.rs:1687` — builder.rs:1687 calls CurrentThread::new(...) directly with the matching argument signature, but this call site is absent from Ariadne's call references for this entry. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/driver.rs:154` — Direct caller using fully-qualified path `crate::runtime::io::Driver::new(nevents)` that Ariadne did not resolve to the entry method. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/driver.rs:272` — ProcessDriver::new(signal_driver) calls Driver::new via a type alias; Ariadne fails to resolve the type alias to process::Driver. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/driver.rs:314` — Direct call to `crate::runtime::time::Driver::new` with matching signature that Ariadne indexed but failed to resolve to the definition at time/mod.rs:145. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/metrics/histogram.rs:281` — HistogramBuilder::new() is called directly from the Default trait implementation in the same file, establishing a real caller that Ariadne's resolution phase failed to link. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/mod.rs:470` — Direct call to `time_alt::Timer::new(handle, deadline)` via module-qualified path that Ariadne's resolver did not link to the definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/scheduler/multi_thread/mod.rs:68` — Explicit type-qualified call `Parker::new(driver)` is the direct caller of this method but was not resolved by Ariadne. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/scheduler/multi_thread/mod.rs:69` — Direct module-qualified call `worker::create(...)` to the flagged function, confirming a real caller exists that Ariadne's resolver failed to link. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/scheduler/multi_thread/queue.rs:90` — AtomicUnsignedShort::new(0) is a direct call to AtomicU16::new via a conditional type alias, but Ariadne does not resolve the alias through the cfg macro. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/scheduler/multi_thread/trace.rs:20` — Calls `Barrier::new(remotes_len)` where `Barrier` is imported as `crate::loom::sync::Barrier`, which is a re-export of the `loom::std::barrier::Barrier` definition under investigation. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/scheduler/multi_thread/worker.rs:312` — Direct call to Idle::new(size) which is the struct-qualified form of the method defined at idle.rs:34, but Ariadne left this reference unresolved. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/task/list.rs:79` — Direct qualified constructor call `ShardedList::new(shard_size)` is the real caller that Ariadne did not resolve to this definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/task/raw.rs:221` — Direct call to Cell::<\_, S>::new() using turbofish syntax that Ariadne's resolver failed to link to the Cell::new definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/time_alt/cancellation_queue.rs:80` — Imports Mutex from crate::loom::sync and calls Mutex::new, which resolves to mocked.rs::Mutex::new under cfg(all(test, loom)) but Ariadne resolves it to the std version. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/time_alt/cancellation_queue/tests.rs:10` — EntryHandle::new(0) is a real call to Handle::new via a pub(crate) use alias, but Ariadne shows resolution_count=0 for this call site. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/time/mod.rs:153` — Direct call to `wheel::Wheel::new()` in the same crate, using the submodule-qualified path `wheel::Wheel::new()`, which Ariadne did not resolve to the `Wheel::new` impl in `time/wheel/mod.rs`. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/signal/windows/sys.rs:35` — RxFuture::new(rx) is called here inside the private fn new, but Ariadne's unresolved call refs from this file resolve to the local fn new (line 32) rather than to RxFuture::new in mod.rs:73 (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/sync/broadcast.rs:1466` — Direct call `Recv::new(self)` in the `recv` method of `Receiver<T>` is the sole caller and is in the same file as the `Recv::new` definition at line 1576, but Ariadne did not link it. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/sync/semaphore.rs:477` — Line 477 calls `ll::Semaphore::new(permits)` where `ll` is a module alias for `batch_semaphore`, but Ariadne does not resolve this aliased path to the `batch_semaphore::Semaphore::new` definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/util/linked_list.rs:498` — Direct call `pointers: Pointers::new()` within the same module, and `linked_list::Pointers::new()` from multiple other modules, all unresolved by Ariadne (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/tests/sync_barrier.rs:16` — sync_barrier.rs calls Barrier::new with multiple arguments across many test functions, confirming real callers exist that Ariadne did not resolve to this definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/tests/sync_rwlock.rs:22` — Direct type-qualified constructor call `RwLock::new(42)` is a real caller that Ariadne did not resolve to this method definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/name_resolution.ts` so the name_resolution pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
