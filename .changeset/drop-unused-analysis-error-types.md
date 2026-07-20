---
"@ariadnejs/types": major
---

Remove the unused `AnalysisError` and `AnalysisPhase` types.

Nothing in the workspace referenced either type. They are dropped along with the
`errors.ts` module that held them. Error reporting flows through the `Result`
type and the resolution-failure types.
