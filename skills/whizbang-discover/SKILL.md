---
name: "Whizbang Discover"
slug: "whizbang-discover"
version: "1.0.0"
description: "Use when starting non-trivial work and need structured discovery: understand intent, explore approaches, produce approved design doc before planning."
author: "Tariux"
license: "MIT"
source: "https://github.com/Tariux/AI-Skills-Not-Awesome"
tags: ["discovery", "brainstorming", "design-doc", "approval-gate"]
category: "Developer Workflow"
compatibility: "universal"
mode: "system-prompt"
---

# Whizbang Discover — Structured Discovery & Design

**One skill. Intent → approaches → approved design doc. No implementation.**

## When to Use

- Starting any feature, project, or initiative where requirements aren't fully specified
- "I want to build X" / "We should do Y" / "Help me think through Z"
- Before any planning or implementation skill
- When you need a written, approved design before committing resources

**Don't use for:** Trivial requests, pure exploration without intent to build, or when human provides a complete spec.

---

## Core Principles

| Principle | Meaning |
|-----------|---------|
| **Discover before decide** | Never plan on assumptions. Structured conversation first. |
| **Approaches before design** | Lay out 2-3 real alternatives with trade-offs before writing design. |
| **Human approves, agent executes** | Hard gate: nothing proceeds without design doc approval. |
| **Visual when helpful** | Offer browser mockups for UI/layout/flow questions. |
| **Spike to learn** | Cheap throwaway build when it clarifies intent. |

---

## Phase 0: Setup — Isolated Workspace

**Announce:** "Setting up isolated workspace with whizbang-discover."

```bash
WORKSPACE=$(bash scripts/init-workspace "your topic here")
cd "$WORKSPACE"
```

**Exit criteria:** Clean baseline tests (or explicit consent to proceed with failures).

---

## Phase 1: Discovery — Structured Conversation

### 1.1 First Message Protocol

Before replying, classify:

| Category | Action |
|----------|--------|
| **Clear, trivial** | Echo back, confirm, **stop** — human doesn't need discovery. |
| **Spec provided** | 200-word playback: what/who/why + code findings + one open question (if why unknown). |
| **Vague/ambiguous** | One open question about biggest unsettled thing. Explain why answer changes what gets built. |

**If human asked for discovery by name:** End there — they want the conversation.

**If not:** End with: *"Or if you'd rather I just dive in, say so."* If accepted, state one how-choice (platform/language) and **stop** — they opted out.

### 1.2 Conversation Loop

**Rules:**
- Ask **one question at a time** — only when answer changes what gets built
- **No menus** — get them describing first ("what does success look like?")
- **Play back** every 200-300 words: describe understood part, ask what's wrong/missing
- **Show don't tell** — when visual helps, offer browser: *"Want me to open a browser tab with some mockups?"*
- **Spike when cheap** — throwaway build to learn. Label throwaway. Keeping it = new request.

**Ground to cover (territory, not script):**
- What kind of thing, what makes it special
- Why now, what success looks like
- Goals, non-goals, anti-goals (what makes it a failure even if it works)
- Prior art: seen elsewhere, loved/hated
- Current state: what exists, what tried
- Details they care about

### 1.3 Lay Out Approaches (Mandatory)

When you understand what they want, **in a message of its own**:
- 2-3 real alternatives, grounded in project reality
- Drop weak ones (work against why, ruled out by existing work)
- Sketch concretely: what each trades off
- Recommend one with reason
- Ask which way to go
- If genuinely one sensible way: say so, explain why others don't fit, present short design

### 1.4 Design Doc (After Approach Picked)

**Write to:** `docs/whizbang/YYYY-MM-DD-<topic>-design.md`

```markdown
# <Feature> Design

## Intent & Why
[One paragraph]

## Goals / Non-Goals / Anti-Goals
- Goal: ...
- Non-goal: ...
- Anti-goal: ...

## Constraints
[Version floors, dep limits, naming rules, platform reqs — exact values]

## Approaches Considered
| Approach | Trade-offs | Decision |
|----------|------------|----------|
| A | ... | Rejected: ... |
| B | ... | **Chosen** — why |
| C | ... | Rejected: ... |

## Chosen Design
[Plain document a builder could plan from]
- Parts of how they decided
- What's left to builder
```

**Hard Gate:** Nothing proceeds until human **approves this doc**. Exceptions: opted out, or spike they approved.

### 1.5 Builder Check (For Projects)

Dispatch fresh subagent with `builder-check-prompt.md`. Sort findings:
- **Answered** → put in doc
- **Minor** → settle yourself, mark as your call
- **Theirs** → bring to human, update doc, hand over with your calls listed

---

## Visual Companion

When a question would be better understood visually (screen, layout, flow, options, diagram):

```bash
bash scripts/start-visual --project-dir /path/to/project --open
```

Share the returned URL. Write HTML fragments to `screen_dir`. Read `state_dir/events` for clicks.

---

## Red Flags

| Thought | Reality |
|---------|---------|
| "Just a simple question" | Questions are tasks. Check phase gates. |
| "Skip discovery, they know what they want" | They usually don't. Design doc gate exists for reason. |
| "I'll fill in sensible defaults" | Good. Say them out loud. A default they never heard is one they couldn't reject. |
| "They said 'sounds good'" | Approval covers what you showed. A doc you haven't written isn't approved. |

---

## Quick Reference

| Phase | Gate | Artifact | Human Action |
|-------|------|----------|--------------|
| 0 Setup | Tests pass | Workspace path | Consent to create |
| 1 Discovery | Design doc approved | `docs/whizbang/...-design.md` | Approve design |

---

## Builder Check Prompt

See `references/builder-check-prompt.md`.

---

## Visual Companion Assets

See `references/frame-template.html` and `references/helper.js`.