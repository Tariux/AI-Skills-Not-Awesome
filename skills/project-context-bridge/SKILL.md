---
name: project-context-bridge
description: Builds compact, high-signal, copy-paste-ready project context for handing software tasks to a separate web chatbot or AI agent with limited context. Supports global and task-focused modes with privacy controls. Use when a developer needs a reusable project brief or task-focused handoff.
license: MIT
metadata:
  author: Tariux
  version: "2.0.0"
  source: https://github.com/Tariux/AI-Skills-Not-Awesome
  category: developer-tools
  tags: context, handoff, privacy, scanner
  output: portable-context-prompt
---

# Project Context Bridge

## Purpose

Create a compact, trustworthy handoff prompt that lets a separate AI model understand an existing software project well enough to perform a requested change without receiving the entire repository. The handoff must preserve important project-wide rules while concentrating detail around the requested task.

This skill is a **context extractor and prompt packager**, not a coding agent. Do not modify, create, delete, format, or refactor project files. Do not claim that a change has been implemented. Your deliverable is text the user can copy into another chatbot.

## Two Operating Modes

Choose the mode from the invocation, without asking the user to repeat information already given.

### Mode A — Global Context

Use when no implementation request or task is supplied.

Produce a reusable overview of the project: what it is, how it is structured, how its main parts interact, key conventions, runtime/dependencies, important documentation, and major constraints. Do not invent a task, propose speculative refactors, or produce a change plan.

### Mode B — Task-Focused Context

Use when the user supplies a task, bug, feature request, or change description alongside the skill.

Produce the same global foundation as Mode A, but allocate more detail to the files and concepts most relevant to that task. Preserve global architecture and rules; **task relevance is a priority filter, not permission to omit important project-wide constraints**. Include the user's task faithfully. The resulting handoff must tell the receiving model to implement the task in the existing project style rather than redesigning the project.

## Non-Negotiable Rules

1. **No repository edits.** Read and inspect only. Do not implement the task, update files, generate patches, or run destructive commands.
2. **Evidence before claims.** Prefer facts verified from repository files. Distinguish facts, reasonable inferences, and unknowns. Never fabricate modules, APIs, commands, dependencies, or behavior.
3. **Inspect before summarizing.** Use available file-tree, search, and read tools to inspect the repository. Do not rely only on folder names. If possible, inspect the relevant source files and the documentation they depend on.
4. **Keep high-value context.** Compress repetition and implementation trivia, not project purpose, architectural boundaries, invariants, conventions, data flow, interfaces, security constraints, or compatibility requirements.
5. **Respect token limits.** Make the handoff as small as possible while preserving information needed to act correctly. Prefer concise facts, compact bullets, and paths over prose. Do not paste large source files when a small explanation and a few relevant signatures are enough.
6. **Don't expose secrets.** Never include credentials, access tokens, private keys, secret environment values, private user data, or contents of `.env` files. Mention that a required secret/config value is external only when relevant; use placeholders rather than values.
7. **Do not force a tool-specific workflow.** Use repository tools already available to you. If no filesystem/repository access exists, do not pretend to have scanned it; use the fallback described below.
8. **Ask only actionable questions.** If essential information is missing, first produce the best useful package possible. Ask at most three concise, high-value questions, each naming the exact file, symbol, log, example, or decision needed and why it matters. Avoid questions answerable from available files.
9. **No generic filler.** Avoid introductions such as "Here is the context," generic best practices, lengthy explanations, repeated instructions, and self-evaluation. Do not add a tutorial unless the user asks for one.
10. **Follow explicit user preferences.** Preserve requested language, output shape, exclusions, and constraints. If the user explicitly asks for explanations, provide them; otherwise optimize for the compact handoff format.

## Repository Inspection Workflow

### 1. Establish Scope and Mode

- Identify the repository root and the user's exact task, if any.
- Do not interpret unrelated chat history as a task for the current repository unless the user explicitly connects it.
- If this is a monorepo, identify the relevant package/service and its shared dependencies. Keep the wider workspace rules that can affect the task.

### 2. Build a Structural Map

Inspect the top-level layout and the main source directories. Identify the project type and likely entry points from actual files, not names alone.

Look for these signals when present:

- `README*`: project purpose, setup, capabilities, examples, limitations.
- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, and similar agent/developer instruction files: mandatory workflow and coding conventions. Inspect applicable files from root to the relevant subdirectory.
- Architecture/design docs, ADRs, package docs, API docs, and domain-specific guides.
- Package/dependency manifests and runtime/build configuration, such as `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, Gradle files, `composer.json`, `requirements.txt`, Docker/Compose files, and relevant compiler configuration.
- Main entry points, service registration, routes/controllers, public interfaces, data models, persistence adapters, event/message handlers, and tests that illustrate established behavior.
- Relevant CI and deployment configuration when it affects compatibility or delivery.

This is a priority guide, not a checklist that must be fully exhausted. Follow existing project conventions and documentation names when they differ.

### 3. Read for Meaning, Not Just Filenames

For each high-value source, extract only what a receiving developer needs to know:

- **README:** purpose, core capabilities, setup or runtime facts that matter.
- **Agent instructions:** non-negotiable project rules, scope limits, naming/style, forbidden actions.
- **Architecture docs:** component boundaries, ownership, dependency direction, key data/control flow.
- **Manifest/config:** language/runtime versions, important dependencies, scripts/commands, package boundaries and feature flags; omit unrelated dependency inventories.
- **Relevant implementation:** current behavior, important symbols/signatures, call chain, interfaces, side effects, persistence/events, error paths, and likely change boundary.
- **Tests/examples:** expected behavior and compatibility constraints; report only what the inspected files support.

In task mode, trace the shortest credible path from the user-visible behavior to the responsible implementation and its adjacent interfaces. Inspect caller and callee boundaries if changing one side could break the other.

### 4. Select Context by Value

Keep information in this order when the budget is tight:

1. User's task and success conditions (Mode B only).
2. Applicable agent instructions, project-wide constraints, and compatibility requirements.
3. Project purpose and architecture relevant to the task.
4. Relevant files/symbols and how they interact.
5. Existing behavior, expected behavior, and important edge cases.
6. Runtime/dependency details, commands, and tests that materially affect implementation.
7. Secondary details that may help, only if space remains.

Remove duplicate explanations, unrelated directories, boilerplate docs, full lockfiles, long changelogs, generated output, vendored code, and unrelated features. Do not discard a constraint merely because it is not task-specific.

### 5. Identify Uncertainty and Context Gaps

Do not ask questions just because some detail is unknown. Ask only when the uncertainty is likely to change the implementation or make a safe handoff impossible.

When a gap remains, name the precise artifact needed. Good examples:

- `src/auth/SessionService.ts`: the complete `refreshSession()` method and its callers, to establish who owns token rotation.
- `docs/events.md`: the event payload contract for `UserUpdated`, to avoid inventing fields.
- A sanitized stack trace for the failing request, including the first application frame, to distinguish an input error from a persistence error.

Bad examples: "Send more code," "Explain the architecture," or several questions asking for information that one file can answer.

If the receiving model should request missing evidence instead of guessing, explicitly instruct it to ask the user for the named files/details in one compact message and wait before making assumptions that affect correctness.

### 6. Generate the Copy-Paste Handoff

Use the output contract in `references/output-contract.md`. Include only verified, high-value context. Keep the task text close to verbatim; clean up wording only if it improves clarity without changing intent.

The assembled message should make sense when pasted into a separate web chatbot with no repository access. State that the receiving model does not have access to the original repository unless files are attached or pasted. Tell it to rely only on included context and request exact missing files when necessary.

### 7. Final Quality Check

Before responding, verify:

- The correct mode was selected.
- The task is included if supplied, and no task was invented otherwise.
- Global project purpose, key architecture, relevant conventions, and critical constraints survived compression.
- Every specific technical claim is grounded in inspected files or clearly labelled as an inference/unknown.
- No secret or unnecessary private value is included.
- The receiving model is explicitly told not to assume access to the repository.
- Output instructions are compact and actionable.
- No implementation, patch, or local project change was performed.

## Optional Inventory Helper

Requires Node.js; no npm dependencies. Run from the skill directory:

```bash
node scripts/scan-project.cjs /path/to/project --budget 4000
```

Or, from the target repository root:

```bash
node /path/to/project-context-bridge/scripts/scan-project.cjs . --task "Fix session refresh handling" --budget 4000
```

**Privacy note**: The helper includes a git working-tree summary by default. For external sharing, **always use `--no-git`** to omit changed/untracked paths that may reveal private state. The `--no-git` flag is recommended for any handoff leaving your machine.

The helper prints a compact inventory and selected documentation/config excerpts to stdout. It does not write files or modify the repository. It excludes common generated/dependency directories and sensitive files. Review its output before sharing it externally; adjust `--budget`, `--max-files`, or `--max-depth` as needed.

The scanner is intentionally only a fallback and inventory aid. It does not replace semantic review of the actual code, and its ranking is heuristic.

## Fallback When Repository Tools Are Unavailable or Time Is Constrained

Never fabricate a repository scan. Switch quickly to a transparent fallback:

1. Ask the user to run the optional inventory helper from the skill directory:

```bash
node scripts/scan-project.cjs /path/to/project --budget 4000
```

On Windows, use the equivalent local path, for example `node scripts/scan-project.cjs . --budget 4000` from the repository root.

2. Ask them to paste the output or attach the generated terminal transcript. The script writes to stdout and does not change project files.

3. If running Node.js is unavailable, request only a compact file tree plus the root README, relevant agent instructions, and the manifest(s). In task mode also request the exact files named by the task, if known.

4. Use the material available to create a clearly labelled **provisional** package. List missing artifacts by exact path and the question each would resolve. Do not block on complete repository coverage when a useful partial package can be created.

If the repository is too large to inspect exhaustively, inspect the project root, applicable instructions, architecture docs, and task-related paths first. Then use the same fallback for remaining uncertainty. Prefer a truthful, bounded package over a sprawling shallow scan.

## Default Behavior

- Output a single copy-paste-ready text block, not a narrative report about your process.
- Do not explain the skill's methodology unless asked.
- For a user who asks only to extract context, generate the reusable global brief.
- For a user who supplies a task, generate a task-focused handoff plus global invariants.
- Never change project code or structure as part of this skill.