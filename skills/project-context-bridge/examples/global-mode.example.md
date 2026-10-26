# Example: global-context mode

```text
# PROJECT CONTEXT HANDOFF

## MODE
GLOBAL CONTEXT ONLY

## PROJECT
- Name/type: `inventory-api`, Node.js service.
- Purpose: Manages inventory updates and exposes a REST API.
- Main runtime/framework: Node.js; exact version and framework should be taken from the included manifest/configuration.

## ARCHITECTURE
- `src/routes/` registers HTTP routes.
- `src/services/` owns business rules.
- `src/adapters/` isolates external persistence/integrations.
- Confirm these boundaries against the actual files before relying on them.

## RULES AND CONSTRAINTS
- Follow root and nested agent instructions.
- Keep API contracts stable unless the future task explicitly changes them.

## RELEVANT FILES
- `README.md`: project scope and setup.
- `AGENTS.md`: required agent workflow.
- `package.json`: scripts, runtime dependencies.

## CURRENT BEHAVIOR / KEY FACTS
- This package contains project-wide context only; no implementation task was supplied.
- Unknown runtime details are not inferred here.

## USER TASK
No implementation task supplied. Preserve this context for a later task; do not invent or implement work.

## INSTRUCTIONS TO THE RECEIVING MODEL
You have only the context and files included in this message; you do not have access to the original repository. Do not invent missing APIs or behavior. When a later task requires evidence not included here, request the exact files and symbols needed. If changes are requested, return only path/status entries followed by complete file contents, using `(UPDATE)`, `(NEW)`, and `(DELETE)`. Add no explanation unless explicitly requested.
```

This is illustrative only; never copy its project claims into a real handoff without verifying them.
