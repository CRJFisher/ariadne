# Building on Ariadne

## High-level features to add

- Link together top-level of the project i.e. docs, top-level functions so there is a singular tree of knowledge for the project
- Call graphs -> Flow charts
- Refactoring help
  - Concisely display call graph
  - Suggest module refactoring. Compare existing modules to LLM-augmented call-graph clusters.
  - Suggest module re-structuring. Would require creation of high-level semantic graph of the project.
  - Suggest information two-way links between docs and code

## Strategy

- There is probably a lot of value in further prototyping of the features in the code-charter repo.
- Then we can split the modules out (e.g. `ui`, *future* `semantic-graph/knowledge-agent`)
- The MCP server graph explain endpoit should speak the same language as the `ui` updates module i.e. the `ui` module should be able to pass accross prompts to the MCP client to direct changes.

## Thoughts

- Code module structure is highly linked to task independence (which is required for multiple-agent development) and so good task architecture is equivalent to good knowledge architecture.
