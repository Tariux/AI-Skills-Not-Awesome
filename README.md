# AI Skills Not Awesome

A curated collection of high‑precision system prompts for LLM‑powered assistants, packaged for the **[skills.sh](https://skills.sh)** ecosystem.  
Each skill lives in its own directory with a `SKILL.md` file that can be dropped directly into any chat session, or installed instantly via the `skills` CLI.

## Quick Install (skills CLI)

```bash
skills add https://github.com/Tariux/AI-Skills-Not-Awesome
```

You’ll be prompted to pick the skills you want:

```
◇  Source: https://github.com/Tariux/AI-Skills-Not-Awesome.git
│
◇  Found 13 skills
│
◆  Select skills to install (space to toggle)
│  ◼ Absolute Mode (Enforces decisive execution without confirmation requests…)
│  ◼ Code Simplifier (Rewrites code to its simplest possible form while preserv…)
│  ◼ Combo Developer (Automatically routes requests to the correct skill…)
│  …
└
```

## Manual Usage

If you don’t use the CLI, you can still grab any skill directly:

1. Open the `skills/<slug>/SKILL.md` file.
2. Copy the **entire file** (YAML frontmatter + body).
3. Paste it into your system prompt or first user message.

The YAML metadata ensures the skill is both human‑readable and machine‑parseable.

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