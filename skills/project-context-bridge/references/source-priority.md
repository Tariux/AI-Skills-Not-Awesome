# Source selection guide

Use this as a ranking guide, not as a mandatory checklist. Every repository differs; follow actual architecture and local instructions.

## Usually high priority

1. Applicable `AGENTS.md` and equivalent agent/developer instructions.
2. Root README and README files for the affected package/service.
3. Architecture docs, ADRs, package-specific design docs, public API/event/schema contracts.
4. Root and affected-package manifests and runtime/configuration definitions.
5. Entry point and files that implement the task's behavior.
6. Callers, callees, interfaces, models, adapters, or middleware that define behavior at the change boundary.
7. Existing tests or examples that explicitly document expected behavior.
8. Deployment/CI files only when relevant to runtime, compatibility, packaging, or release behavior.

## Often low priority unless task-relevant

- Lockfiles and generated files.
- Build artifacts, caches, compiled output, coverage, vendored dependencies, `node_modules`, virtual environments.
- Long changelogs, unrelated docs, unrelated packages, snapshots that duplicate implementation details.
- Entire source files when a few symbols and interactions are sufficient.

## Task relevance signals

Increase priority for files containing the task's named:

- route, command, component, class, function, event, message, model, API, configuration key, error text, or feature flag;
- caller/callee, contract, schema, adapter, and test boundary for those symbols;
- project rules or architecture that constrain those files.

Do not let keyword matching override architectural importance. A root instruction file still matters even if it doesn't contain task keywords.

## Handling ambiguity

When source files disagree, do not silently pick one. Summarize the conflict and prefer authoritative contracts or active runtime wiring over stale docs, unless the repository explicitly says otherwise. Mention the precise conflicting paths when they materially affect implementation.

## Sensitive material

Never copy secret values into the handoff. Do not read or include `.env` contents, credentials, private keys, access tokens, database passwords, cookie/session secrets, or personal data. Safe example files may be described, but verify they contain placeholders before quoting them.
