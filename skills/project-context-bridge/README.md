# Project Context Bridge

A portable Agent Skill for preparing compact project context to paste into a separate web chatbot or AI coding agent. It supports **global context mode** (no task supplied) and **task-focused mode** (context is selected around a request while preserving global project constraints).

The skill never edits project files. Its output is a prompt package, not an implementation.

## Contents

```text
project-context-bridge/
├── SKILL.md
├── README.md
├── references/
│   ├── output-contract.md
│   └── source-priority.md
├── examples/
│   ├── global-mode.example.md
│   └── task-mode.example.md
└── scripts/
    └── scan-project.cjs
```

## Installation

Place this directory in the skills directory supported by your agent/client. For clients using the shared Agent Skills convention, a common location is `.agents/skills/project-context-bridge/` inside a repository. Other clients may use a client-specific skills directory. Keep the directory name aligned with the `name` field in `SKILL.md`.

## Use

Invoke the skill with no task to create a reusable project-wide context handoff. Invoke it alongside a concrete task to create a task-focused handoff that still preserves global rules, architecture, and compatibility constraints.

The skill uses the current agent's repository-reading tools when available. If they are unavailable, it can request the output of the optional scanner below.

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

## Limitations

- Results depend on which files the current agent can actually access.
- A filename inventory alone cannot establish real execution flow or behavior.
- A limited web chatbot may still need a precise follow-up file or contract; the handoff should ask for that evidence rather than guessing.
- Review all material before sending it to third-party chatbots, especially in proprietary repositories.