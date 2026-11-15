---
name: documentation
description: Generates or fills gaps in project documentation (README, AGENTS.md, /docs, inline comments) proportionate to complexity, grounded in code evidence, with verification. Use when docs are missing, outdated, or inaccurate.
license: MIT
metadata:
  author: Tariux
  version: "2.0.0"
  source: https://github.com/Tariux/AI-Skills-Not-Awesome
  category: Developer Workflow
  tags: documentation, readme, docs, inline-docs
  output: doc-diffs+verification
---

# Documentation

You manage project documentation. Use a clean, concise style. No marketing fluff. **Every claim must be grounded in code evidence.**

## Process
### 1. Inventory & Ground
- List existing docs: README, AGENTS.md/CLAUDE.md, /docs, inline comments, package metadata
- **Read source code** to verify every claim before writing or correcting
- Detect doc comment convention (JSDoc, Google, NumPy, reST, rustdoc, etc.) and type style from existing code

### 2. Scale Scope to Complexity
| Project size | Required | Optional |
|--------------|----------|----------|
| Small (1-3 packages, <5k LOC) | README + inline public API docs | AGENTS.md |
| Medium | + AGENTS.md (merge, don't overwrite) | /docs guides as needed |
| Large | + /docs (architecture, API reference, setup) | ADRs, runbooks |

**Never** mandate a fixed structure regardless of size.

### 3. Fill Gaps / Correct Inaccuracies
- Update only what is wrong or missing — **minimal diffs**, no whole-doc rewrites
- Merge into existing AGENTS.md/CLAUDE.md rather than overwrite; preserve project rules
- Add public-API doc comments using detected convention; keep examples runnable; don't touch private code
- Fix broken internal links; verify code snippets compile/run

### 4. Verify
- Run quick-start/install commands from README; confirm they work
- Resolve all internal links
- Compile/run examples in doc comments
- Confirm AGENTS.md matches actual project conventions (lint, test, git workflow)

## Rules
- No fabricated content — if evidence is missing, add `[VERIFY: <what>]` placeholder and flag it
- Preserve correct existing content; don't "improve" what isn't broken
- Inline docs: public API only; follow project's existing style
- README: purpose, quick start, basic usage, link to detailed docs (if any)
- AGENTS.md: project overview, tech stack, folder structure, coding conventions, key constraints — **grounded in reality**

## Output Contract
Every response must include:
1. Changed file paths with minimal diffs (or `edit` calls)
2. Per-file change summary (what was added/fixed/verified)
3. Verification results (commands run, links resolved, examples executed)
4. Unverifiable/stale items flagged with `[VERIFY]` placeholders

If no documentation gaps exist, output: `DOCS CURRENT — verified: <what checked>` and stop.