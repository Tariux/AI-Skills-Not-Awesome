# AI Skills Not Awesome

A curated collection of high‑precision system prompts for LLM‑powered assistants, packaged for the **[skills.sh](https://skills.sh)** ecosystem. Each skill lives in its own directory with a `SKILL.md` file that can be dropped directly into any chat session, or installed instantly via the `skills` CLI.

## Quick Install (skills CLI)

```bash
skills add https://github.com/Tariux/AI-Skills-Not-Awesome
```

You'll be prompted to pick the skills you want:

```
◇  Source: https://github.com/Tariux/AI-Skills-Not-Awesome.git
│
◇  Found 14 skills
│
◆  Select skills to install (space to toggle)
│  ◼ Absolute Mode (Enforces decisive execution without confirmation requests…)
│  ◼ Code Simplifier (Rewrites code to its simplest possible form while preserv…)
│  ◼ Combo Developer (Automatically routes requests to the correct skill…)
│  ◼ Debugging (Systematic root-cause isolation and minimal fix proposal…)
│  ◼ Documentation (Generates or fills gaps in project documentation…)
│  ◼ Freelance Bid Analyzer (Analyzes a project description and outputs a…)
│  ◼ No-Slop (Writing engine that audits and rewrites prose for AI-resistance…)
│  ◼ Open Source Advisor (Evaluates open-source packages: health, suitability…)
│  ◼ Optimizer (Systems-level performance engineer: identifies hotspots…)
│  ◼ Package Audit (Produces a rigorous, forward-looking technical audit…)
│  ◼ Planner (Breaks down complex tasks into ordered, verifiable sub-tasks…)
│  ◼ Project Analyzer (Produces a concise, structured analysis report…)
│  ◼ Project Context Bridge (Builds compact project context for handoff…)
│  ◼ Test Engineer (Creates or completes a medium-coverage test suite…)
└
```

## Manual Usage

If you don't use the CLI, you can still grab any skill directly:

1. Open the `skills/<slug>/SKILL.md` file.
2. Copy the **entire file** (YAML frontmatter + body).
3. Paste it into your system prompt or first user message.

The YAML metadata ensures the skill is both human‑readable and machine‑parseable.

## Skill Catalog

| Slug | Name | Category | Description |
|------|------|----------|-------------|
| `absolute-mode` | Absolute Mode | Behavioral | Decisive execution, no social padding. |
| `analyzer` | Project Analyzer | Code Analysis | Structured dependency and workflow report with evidence. |
| `audit` | Package Audit | Code Analysis | Rigorous technical audit with severity ratings and evidence. |
| `combo` | Combo Developer | Meta | Auto‑routes to the correct skill based on request intent. |
| `debugging` | Debugging | Developer Workflow | Root‑cause isolation and minimal fix proposal with verification. |
| `documentation` | Documentation | Developer Workflow | Proportionate docs grounded in code evidence with verification. |
| `no-slop` | No‑Slop | Writing | Fidelity‑first prose audit and anti‑slop rewrite with operationalized gates. |
| `optimizer` | Performance Optimizer | Code Analysis | Systems‑level optimization with measured benchmark deltas. |
| `planner` | Planner | Developer Workflow | Actionable, dependency‑aware task breakdown with acceptance criteria. |
| `simplifier` | Code Simplifier | Developer Workflow | KISS/YAGNI refactoring with characterization tests and verification. |
| `test-writing` | Test Engineer | Developer Workflow | Risk‑selected, run‑verified test suite setup and gap filling. |
| `freelance-bid-analyzer` | Freelance Bid Analyzer | Specialized Advisory | Scope, effort ranges with confidence, risk, and assumptions register. |
| `open-source-advisor` | Open Source Advisor | Specialized Advisory | Health, suitability, dependency risk evaluation with time‑stamped evidence. |
| `project-context-bridge` | Project Context Bridge | Developer Tools | Compact, privacy‑aware project context for AI handoff. |

## License

MIT © [Tariux](https://github.com/Tariux)