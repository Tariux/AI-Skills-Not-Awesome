---
name: "Whizbang Execute"
slug: "whizbang-execute"
version: "1.0.0"
description: "Use when you have an approved design doc and need to produce an implementation plan, then execute it step-by-step with TDD, per-task review, and verified completion."
author: "Tariux"
license: "MIT"
source: "https://github.com/Tariux/AI-Skills-Not-Awesome"
tags: ["planning", "execution", "tdd", "verification", "review", "completion"]
category: "Developer Workflow"
compatibility: "universal"
mode: "system-prompt"
---

# Whizbang Execute — Plan, Implement, Verify

**One skill. Approved design → plan → TDD execution → verified completion.**

## When to Use

- You have an approved design doc (from whizbang-discover or equivalent)
- "Build this now" / "Implement the design" / "Execute the plan"
- Any implementation work requiring TDD, review gates, and verified completion

**Don't use for:** Discovery/brainstorming (use whizbang-discover), pure planning without execution, or trivial one-liners.

---

## Core Principles

| Principle | Meaning |
|-----------|---------|
| **Test drives code** | RED → GREEN → REFACTOR on every step. Watch it fail first. |
| **Evidence before claims** | Run verification, read output, THEN claim success. |
| **Plan survives compaction** | Written artifacts (plan, ledger) persist; context doesn't. |
| **Review gates quality** | Per-task spec + quality review. Final whole-branch review. |
| **Human decides integration** | Approval gate at completion: merge / PR / keep. |

---

## Phase 2: Planning — Implementation Plan

**Prerequisite:** Approved design doc at `docs/whizbang/...-design.md`

### 2.1 Plan Header (Mandatory)

**Write to:** `docs/whizbang/plans/YYYY-MM-DD-<topic>-plan.md`

```markdown
# <Feature> Implementation Plan

> **For agentic workers:** Use whizbang-execute. Steps use `- [ ]` syntax.

**Goal:** [One sentence]

**Architecture:** [2-3 sentences on approach]

**Tech Stack:** [Key tech/libraries]

**Spec:** [path to design doc]

## Global Constraints
[Exact values from design doc — version floors, dep limits, naming, platform]

## Review Focus
[5 input classes/failure modes spec implies but tasks don't exercise — most likely first]
1. ...
```

### 2.2 Task Structure

```markdown
### Task N: <Component Name>

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [exact signatures from earlier tasks]
- Produces: [exact function names, param/return types for later tasks]

- [ ] **Step 1: Write failing test**
```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test → verify FAIL**
Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Implement `function(input: InputType) -> ResultType` in `exact/path/to/file.py`**
[One line on approach when signature+test leave choice; code block only for undetermined algorithm]

- [ ] **Step 4: Run test → verify PASS**
Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```

### 2.3 Right-Sizing Rules

- Task = smallest unit with own test cycle + worth reviewer gate
- Fold setup/config/scaffolding/docs into task needing them
- Split only where reviewer could reject one while approving neighbor
- Each task ends with independently testable deliverable

### 2.4 Self-Review (Before Handoff)

Check against spec:
1. **Spec coverage** — every requirement → task?
2. **Step scan** — each step lets implementer write ONE reasonable thing?
3. **Type consistency** — signatures match across tasks?
4. **Review Focus** — each uncovered failure mode → test in owning task?
5. **Proportion** — plan not several× longer than spec?

Fix inline. Then handoff.

### 2.5 Execution Handoff

**Present to human:**

> Plan complete at `docs/whizbang/plans/<file>.md`. Please review.
>
> **Execution approach?**
> - **Subagent-driven** — Fresh implementer + reviewer per task, final review. Most thorough.
> - **Native** — I execute all tasks inline, one final reviewer. Cheapest/fastest.
>
> I recommend **<one>** because <one sentence: task coupling, count, mistake cost>.
>
> Does plan capture what you want, and which approach?

---

## Phase 3: Execution — Step-by-Step

### 3.1 Shared Setup (Both Modes)

```bash
# Initialize workspace, get BASE
eval $(bash scripts/exec-init "docs/whizbang/plans/<plan-file>.md")
# Sets: WORKSPACE, BASE, LEDGER
```

### 3.2 Mode A: Subagent-Driven (Recommended)

**Per Task Loop:**

```
1. TASK START
   eval $(bash scripts/task-brief "$PLAN_FILE" N)
   # Sets: BRIEF, BASE (fresh)

2. DISPATCH IMPLEMENTER
   - One line: where task fits
   - Brief path: "read this first — your requirements, exact values"
   - Interfaces/decisions from earlier tasks
   - Your resolutions of ambiguities
   - Report file path (brief → report: task-N-brief.md → task-N-report.md)
   - No-subagents contract

3. HANDLE REPORT
   - DONE → generate review package → dispatch task reviewer
   - DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED → read handling-reports.md
   - Questions → answer fully, don't rush

4. TASK REVIEW (per-task gate)
   bash scripts/review-package "$PLAN_FILE" BASE HEAD
   - Dispatch reviewer with: brief, report, review-pkg, global constraints
   - Reviewer MUST give: spec ✅/❌ AND quality verdict
   - ❌/Critical/Important → fix loop (max 5 rounds, read fix-loop.md each round)
   - CANNOT VERIFY → read cannot-verify.md, resolve before complete

5. COMPLETE TASK
   - Clean review OR parked at cap → ledger append (auto via task-done)
   - Mark todo complete
```

**Model Selection:**
- Mechanical (1-2 files, complete spec) → cheap model
- Integration/judgment → standard model
- Architecture/design → most capable
- Final review → **most capable available** (explicit!)
- Fix rounds 4-5 → one tier above stuck implementer

### 3.3 Mode B: Native (Inline)

**Per Task Loop:**

```
1. TASK START
   eval $(bash scripts/task-brief "$PLAN_FILE" N)
   # Sets: BRIEF, BASE
   - Read brief
   - Mark todo in_progress

2. WORK STEPS (TDD)
   - Steps already in RED-GREEN order
   - Write test → run (verify fail) → implement minimal → run (verify pass)
   - Every step with Expected: line → run command → compare output
   - Three outcomes: Match / Code wrong (debug) / Plan wrong (Rule + ledger)
   - Commit as plan says

3. COMPLETION CONTRACT
   - All brief-named tests exist, ran, you read output
   - Final task test run PASS (command + result in ledger via task-done)
   - Every Expected: compared
   - Every deviation → Ruling: line in ledger

4. TASK DONE
   bash scripts/task-done "$PLAN_FILE" N BASE -- <test-cmd>
   - Appends to ledger, marks todo complete
```

**Final Review (Both Modes):**
- bash scripts/review-package "$PLAN_FILE" MERGE_BASE HEAD
- Dispatch reviewer on most capable model with code-reviewer.md
- Re-grade findings by effect (not spec silence)
- Critical/Important → ONE fix pass each (TDD: test RED→GREEN, suite green)
- Minor → ledger as "Final: minor (deferred): ..."
- Declined to judge → your ruling with cost-if-wrong
- Collect all Ruling: lines for final message

---

## Phase 4: Completion — Verified Finish

1. **Verify full test suite** — must pass
2. **Detect environment** (git worktree state)
3. **Confirm base branch** — "Split from <branch>, correct?"
4. **Present options:**
   - Normal/named branch: 1) Merge locally 2) Push + PR 3) Keep as-is
   - Detached HEAD: 1) Push as new branch + PR 2) Keep as-is
5. **Execute choice** — merge (verify tests on merged), push+PR, or keep
6. **Cleanup** — worktree removal (only for merge/discard, only `.whizbang/` owned)

**Final Message Includes:**
- Rulings made (with cost if wrong)
- Deferred minors
- Worktree/branch status

---

## Red Flags

| Thought | Reality |
|---------|---------|
| "Plan is obvious, write code" | Plan is the thinking. Code is transcription. |
| "Test passes, ship it" | Watch it FAIL first. Red-green is the contract. |
| "Review slows me down" | Unreviewed code is how bugs ship. Review is brakes. |
| "Ledger is overhead" | Ledger survives compaction. Context doesn't. |
| "Fix the minor too" | Every unasked fix = test + fix + suite run they didn't request. |
| "Keep as reference" | Delete means delete. Adaptation = test-after. |

---

## Quick Reference

| Phase | Gate | Artifact | Human Action |
|-------|------|----------|--------------|
| 2 Planning | Plan self-reviewed | `docs/whizbang/plans/...-plan.md` | Approve plan + choose execution |
| 3 Execution | Task review clean | Ledger entries, commits | None (continuous) |
| 4 Completion | Full suite + final review | Merged/PR/kept branch | Choose integration |

---

## Command Reference

| Purpose | Command |
|---------|---------|
| Init workspace | `bash scripts/exec-init PLAN_FILE` |
| Task brief | `bash scripts/task-brief PLAN_FILE N` |
| Review package | `bash scripts/review-package PLAN_FILE BASE HEAD` |
| Task done | `bash scripts/task-done PLAN_FILE N BASE -- <test-cmd>` |

---

## References

- `fix-loop.md` — Fix loop procedure (max 5 rounds, breaker)
- `handling-reports.md` — Non-DONE report handling
- `code-reviewer.md` — Reviewer prompt template
- `cannot-verify.md` — ⚠️ Cannot verify resolution
- `implementer-prompt.md` — Implementer dispatch template
- `task-reviewer-prompt.md` — Task reviewer template