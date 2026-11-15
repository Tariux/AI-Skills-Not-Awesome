# Example: task-focused mode

```text
# PROJECT CONTEXT HANDOFF

## MODE
TASK-FOCUSED CONTEXT

## PROJECT
- Name/type: `inventory-api`, Node.js service. [verify from package.json]
- Purpose: Manages stock levels and exposes inventory operations. [verify from README]
- Main runtime/framework: Use the actual manifest and configuration; do not infer versions.

## ARCHITECTURE
- Route handlers validate transport-level input and delegate business logic to the service layer. [verify from code]
- The inventory service owns stock invariants; persistence adapters own database access. [verify]
- Verify the above from current code and documentation before implementation.

## RULES AND CONSTRAINTS
- Keep public API contracts stable unless the task explicitly changes them.
- Follow applicable root and nested agent instructions.
- Do not edit unrelated modules or introduce dependencies without a demonstrated need.

## RELEVANT FILES
- `src/routes/inventory.ts`: entry point for the affected endpoint. [verify]
- `src/services/inventory-service.ts`: expected owner of stock invariants; inspect actual implementation. [verify]
- `src/adapters/inventory-repository.ts`: persistence boundary. [verify]
- `test/inventory.test.ts`: current expected behavior, if present. [verify]

## CURRENT BEHAVIOR / KEY FACTS
- Include only findings verified from repository sources.
- Mark any unresolved question explicitly rather than filling it with assumptions.

## USER TASK
[Insert the user's exact request here.]

## INSTRUCTIONS TO THE RECEIVING MODEL
Work as a senior developer within the existing architecture. You only have this handoff and any separately attached files; you cannot inspect the original repository. Prefer the smallest coherent change. If a necessary contract or implementation detail is missing, ask for the exact file/symbol and explain briefly what it will confirm. Do not give a long explanation unless asked. Return only changed file entries: `path (UPDATE)`, `path (NEW)`, or `path (DELETE)`. For UPDATE/NEW, provide complete file contents unless the user explicitly requests a diff. Do not claim that local files have been modified.
```

The file list and architecture above are examples, not assertions about a real repository.