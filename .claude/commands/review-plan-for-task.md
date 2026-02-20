Please run reviewer subagents to analyse this plan, focussing on:

- information-architecture review - make sure the changes fit well with or evolve namings and architectural structure appropriately, including folder/file/function renamings, creations and removals.
- simplicty-review - are the planned code implementations as simple as possible? Could we make better use function-delegation or intermediary-data-models (translating data to a more useful format or data structure) to simplify the code?
- fundamentaility-review - making sure we're addressing the problem in the fundamental way possible
- language-specific coverage review
  - make sure we have appropriate coverage for all languages which support this functionality
  - include fixtures and integration tests that use the fixtures at all the appropriate integration testing levels
  - if the changes include language-specific code handling, make sure its being handled by language-specific sub-modules and that the parent module is well-structured for language-specific dispatch. If there is no language-specific code handling, make sure the plan is well-structured for language-agnostic dispatch.
- are we including extra, unnecessary components e.g. data model fields? make sure we're not adding unnecessary complexity to the codebase. Apply the YAGNI principle

Synthesise the outputs of these agents into an updated plan and then update the task doc.
