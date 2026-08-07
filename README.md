# AI Skills Not Awesome

A curated collection of high‑precision system prompts for LLM‑powered assistants.
Each `.skill.md` file is a drop‑in instruction set that can be copied directly into any
chat session to instantly shape the assistant’s behavior, reasoning, and output style.

## Quick Start

1. Open any `.skill.md` file.
2. Copy the **entire file** (including the YAML frontmatter).
3. Paste it into your system prompt or first user message.
4. The assistant will parse the metadata and adopt the embedded instruction.

## Format

All skills follow a **Markdown + YAML frontmatter** schema, inspired by platforms like
[skills.sh](https://skills.sh). The frontmatter contains machine‑readable metadata; the
body is the exact system prompt you inject.

```yaml
---
name: "Skill Name"
slug: "skill-slug"
version: "1.0.0"
description: "A one‑line summary."
author: "Tariux"
license: "MIT"
source: "https://github.com/Tariux/AI-Skills-Not-Awesome"
tags: ["tag1", "tag2"]
category: "Category"
compatibility: "universal"
mode: "system-prompt"
---
```

## Skill Catalog

| Slug | Name | Category | Description |
|------|------|----------|-------------|
| `absolute-mode` | Absolute Mode | Behavioral | Decisive execution, no social padding. |
| `analyzer` | Project Analyzer | Code Analysis | Structured dependency and workflow report. |
| `audit` | Package Audit | Code Analysis | Rigorous technical audit with severity ratings. |
| `combo` | Combo Developer | Meta | Auto‑routes to the correct skill based on request. |
| `debugging` | Debugging | Developer Workflow | Root‑cause isolation and minimal fix proposal. |
| `documentation` | Documentation | Developer Workflow | Generates or fills gaps in project documentation. |
| `no-slop` | No‑Slop | Writing | Fidelity‑first prose audit and anti‑slop rewrite. |
| `optimizer` | Performance Optimizer | Code Analysis | Systems‑level optimization with trade‑off notes. |
| `planner` | Planner | Developer Workflow | Actionable, dependency‑aware task breakdown. |
| `simplifier` | Code Simplifier | Developer Workflow | KISS/YAGNI refactoring, zero new functionality. |
| `test-writing` | Test Engineer | Developer Workflow | Medium‑coverage test suite setup and gap filling. |
| `freelance-bid-analyzer` | Freelance Bid Analyzer | Specialized Advisory | Scope, effort, risk, and pricing analysis for bids. |
| `open-source-advisor` | Open Source Advisor | Specialized Advisory | Health, suitability, and dependency risk evaluation. |

## License

MIT © [Tariux](https://github.com/Tariux)
