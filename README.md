# AI-Skills-Not-Awesome

A curated collection of operational system prompts and behavioral patterns for AI assistants, LLM agents, and prompt engineers. Each `.skill.md` file can be injected as a primary system instruction to enforce specific reasoning, execution, or formatting behaviors.

---

## File Reference

| File | Description |
| :--- | :--- |
| `Absolute-Mode.skill.md` | Enforces decisive execution without confirmation requests; suppresses redundant explanations and prioritizes direct action. |
| `Analyzer.skill.md` | Deconstructs input (code, text, data) into atomic components, maps causal relationships, and outputs a structured layer-by-layer analysis. |
| `Audit.skill.md` | Evaluates code, documentation, or outputs against defined quality metrics (security, performance, readability) and returns a prioritized issue report. |
| `Combo.skill.md` | Chains or parallelizes two or more skills into a single pipeline to produce integrated multi-expertise outputs. |
| `Debugging.skill.md` | Steps through errors systematically, isolates root causes, and proposes verified fixes with minimal side effects. |
| `Documentation.skill.md` | Generates or refines technical documentation, API references, and inline comments following standard formatting conventions. |
| `Optimizer.skill.md` | Refactors and tunes code or logic for improved speed, memory usage, or maintainability without altering core functionality. |
| `Planner.skill.md` | Breaks down complex tasks into ordered, verifiable sub-tasks with clear dependencies and estimated effort markers. |
| `Simplifier.skill.md` | Reduces complexity by removing redundancies, flattening nested structures, and translating jargon into plain language. |
| `Test-Writing.skill.md` | Designs unit, integration, or end-to-end test suites covering edge cases, boundaries, and failure modes for given codebases. |
| `other/` | Contains supplementary resources, auxiliary templates, or experimental skill drafts not yet promoted to the root level. |

---

## Usage

Copy the content of any `.skill.md` file into your system prompt or initial user message. Optionally, combine multiple skills via `Combo.skill.md` for compound workflows.

---

## Requirements

- An LLM or AI agent platform that accepts system-level prompts.
- No external dependencies or installations required.

---

## Contribution

Add new `.skill.md` files following the established format: clear title, objective, step-by-step instructions, and a concrete output example.