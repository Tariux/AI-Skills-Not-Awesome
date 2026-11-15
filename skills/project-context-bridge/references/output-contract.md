# Output contract

The final answer is a portable prompt for a second AI model. It is not a report of work performed by this skill. Preserve the user's language unless a different language is requested. Keep the body compact enough to paste into a typical web chatbot, and do not include information that the receiving model does not need.

## Required structure

Use this sequence. Omit a subsection only when it genuinely does not apply.

```text
# PROJECT CONTEXT HANDOFF

## MODE
GLOBAL CONTEXT ONLY
```

or:

```text
## MODE
TASK-FOCUSED CONTEXT
```

```text
## PROJECT
- Name/type:
- Purpose:
- Main runtime/framework:

## ARCHITECTURE
- Main components and responsibilities.
- Important dependency direction or data/control flow.
- Relevant integration boundaries.

## RULES AND CONSTRAINTS
- Applicable agent/developer rules.
- Compatibility requirements, established conventions, and explicit non-goals.

## RELEVANT FILES
- `path/to/file`: why it matters; verified behavior or symbols to inspect.
- Keep this a short, ranked list, not a full repository tree.

## CURRENT BEHAVIOR / KEY FACTS
- Include only facts that influence understanding or implementation.
- Distinguish verified facts from assumptions or unknowns.

## USER TASK
[Include the user's task faithfully. In global mode state: "No implementation task supplied. Preserve this context for a later task; do not invent or implement work."]

## INSTRUCTIONS TO THE RECEIVING MODEL
- You are a senior developer working within the existing project, not redesigning it.
- You have only the context and files included in this message; do not claim access to the original repository.
- Follow the stated project rules and established patterns. Prefer the smallest coherent change that satisfies the task.
- Do not invent missing APIs, behavior, configuration, or file contents. If required information is unavailable, ask concise, specific questions that name exact files/symbols or decisions and explain what each resolves. Ask only what blocks correctness.
- Do not provide a long explanation unless the user explicitly asks for one.
- If a change is requested, return the result in the exact file-oriented format below.
```

## File-oriented implementation response

The receiving model must return only the file entries needed to apply the change, unless the user explicitly requests explanation, alternatives, or a diff.

For each changed or added file, use the path first and the status in parentheses:

```text
path/to/existing-file.ts (UPDATE)
[Provide the complete revised file content, unless the user explicitly requested a patch/diff or a small targeted edit.]

path/to/new-file.ts (NEW)
[Provide the complete new file content.]

path/to/obsolete-file.ts (DELETE)
```

Use only these status labels:

- `(UPDATE)` — an existing file must change.
- `(NEW)` — a new file must be created.
- `(DELETE)` — an existing file must be removed.

Do not list unchanged files. Do not label a file `(UPDATE)` merely because it was inspected. If the task does not require a repository file change, state that clearly in one concise line. Do not claim to have applied changes to the user's local repository. **If the destination platform requires code fences, wrap each file entry in a fence; the path/status line must remain the first line of each entry.**

## Missing-context response

If the task cannot be completed reliably from the supplied context, the receiving model should not fabricate a file implementation. It should output a compact request such as:

```text
NEEDED CONTEXT
- `src/auth/SessionService.ts`: include `refreshSession()` and its callers; needed to verify token rotation ownership.
- `docs/api-contract.md`: include the request/response schema for `POST /sessions`; needed to preserve the public contract.
```

Ask one concise question per genuinely independent blocker. Combine related file requests where possible. If enough context exists to proceed safely, do not ask questions merely for completeness.

## Budgeting

- Prefer a handoff that fits in about 1,500–4,000 tokens; exceed that only when complexity requires it.
- Include full code only when a compact signature or behavior summary is insufficient for the receiving model to reason safely.
- Prefer exact file paths and symbol names over generic descriptions.
- Keep context global enough to protect architecture and narrow enough to fit the receiving model's limits.
- If context must be cut, keep user task, mandatory rules, core architecture, relevant interfaces, and known constraints. Remove repeated details first.