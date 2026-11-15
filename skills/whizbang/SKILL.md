---
name: "Whizbang"
slug: "whizbang"
version: "1.0.0"
description: "Unified brainstorming, planning, and execution skill. Use when starting any non-trivial work: idea → structured discovery → detailed plan → step-by-step implementation → verified completion. Single skill replaces fragmented workflow."
author: "Tariux"
license: "MIT"
source: "https://github.com/Tariux/AI-Skills-Not-Awesome"
tags: ["brainstorming", "planning", "execution", "tdd", "verification", "discovery", "end-to-end"]
category: "Developer Workflow"
compatibility: "universal"
mode: "system-prompt"
---

# Whizbang — Unified Discovery, Planning & Execution

**One skill. Idea to verified code. No handoffs.**

## When to Use

- Starting any feature, refactor, bug fix, or project from scratch
- "I want to build X" / "Fix this bug" / "Add that feature"
- Any work where requirements aren't fully specified
- When you want one continuous flow instead of skill-switching

**Don't use for:** Trivial one-liners, pure exploration, or when human explicitly wants only planning OR only implementation.

---

## Core Principles

| Principle | What It Means |
|-----------|---------------|
| **Discover before decide** | Never build on assumptions. Structured conversation first. |
| **Evidence before claims** | Run verification, read output, THEN claim success. |
| **One step at a time** | Each phase has clear entry/exit criteria. No skipping. |
| **Test drives code** | RED → GREEN → REFACTOR on every implementation step. |
| **Plan survives compaction** | Written artifacts (spec, plan, ledger) persist; context doesn't. |
| **Human decides, agent executes** | Approval gates at discovery→plan and plan→execute transitions. |

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: SETUP                                                 │
│  Detect isolation → create worktree → baseline tests            │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: DISCOVERY (Brainstorming)                             │
│  Understand intent → lay out approaches → design doc → APPROVE  │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼ (human approval)
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: PLANNING                                              │
│  Spec → implementation plan with tasks, interfaces, tests       │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼ (human approval)
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: EXECUTION                                             │
│  Task loop: brief → TDD → verify → commit → ledger → review     │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: COMPLETION                                            │
│  Full suite → final review → merge/PR/keep → cleanup            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Setup — Isolated Workspace

**Run once at start. Announce: "Setting up isolated workspace with whizbang."**

```bash
# 0.1 Detect existing isolation
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
SUPERPROJECT=$(git rev-parse --show-superproject-working-tree 2>/dev/null)

if [ "$GIT_DIR" != "$GIT_COMMON" ] && [ -z "$SUPERPROJECT" ]; then
  echo "Already in worktree at $(pwd) on $BRANCH"
  WORKTREE_EXISTS=1
else
  WORKTREE_EXISTS=0
fi

# 0.2 Create worktree if needed
if [ "$WORKTREE_EXISTS" = "0" ]; then
  # Prefer native tool if available (EnterWorktree, /worktree, etc.)
  # Fallback: git worktree
  LOCATION=".worktrees"
  [ -d "worktrees" ] && [ ! -d ".worktrees" ] && LOCATION="worktrees"
  git check-ignore -q "$LOCATION" 2>/dev/null || { echo "$LOCATION" >> .gitignore; git add .gitignore; git commit -m "chore: ignore worktree dir"; }
  BRANCH_NAME="whizbang-$(date +%s)-$(echo "$1" | tr ' ' '-' | cut -c1-30)"
  git worktree add "$LOCATION/$BRANCH_NAME" -b "$BRANCH_NAME"
  cd "$LOCATION/$BRANCH_NAME"
fi

# 0.3 Project setup
[ -f package.json ] && npm install
[ -f Cargo.toml ] && cargo build
[ -f requirements.txt ] && pip install -r requirements.txt
[ -f pyproject.toml ] && poetry install
[ -f go.mod ] && go mod download

# 0.4 Baseline tests
TEST_CMD="${WHIZBANG_TEST_CMD:-npm test}"
$TEST_CMD
echo "Baseline: $($TEST_CMD 2>&1 | tail -1)"
```

**Exit criteria:** Clean test suite. If failing, report and ask to proceed/investigate.

---

## Phase 1: Discovery — Structured Brainstorming

**Goal:** Produce an approved **Design Doc** at `docs/whizbang/YYYY-MM-DD-<topic>-design.md`.

### 1.1 First Message Protocol

Before replying, classify the request:

| Category | Action |
|----------|--------|
| **Clear, trivial** ("make icon blue") | Echo back, implement directly, skip to Phase 3 |
| **Spec/plan provided** | 200-word playback: what/who/why + relevant code findings + one open question (if why unknown) + offer to dive in |
| **Vague/ambiguous** | One open question about biggest unsettled thing. Say why answer changes what gets built. |

**If human asked for brainstorming by name:** End message there — they want the conversation.

**If not:** End with light offer: *"Or if you'd rather I just dive in, say so."* If they accept, state one how-choice (platform/language) and proceed to Phase 3.

### 1.2 Conversation Loop

**Rules:**
- Ask **one question at a time** — only when answer changes what gets built
- **No menus** — get them describing first ("what does success look like?")
- **Play back** every 200-300 words: describe understood part back, ask what's wrong/missing
- **Show don't tell** — when visual helps, offer browser mockup: *"Want me to open a browser tab with some mockups?"*
- **Spike when cheap** — throwaway build to learn. Label it throwaway. Keeping it = new request.

**Ground to cover (territory, not script):**
- What kind of thing, what makes it special
- Why now, what success looks like
- Goals, non-goals, anti-goals (what makes it a failure even if it works)
- Prior art: seen elsewhere, loved/hated
- Current state: what exists, what tried
- Details they care about

### 1.3 Lay Out Approaches (Mandatory Before Design Doc)

When you understand what they want, **in a message of its own**:
- 2-3 real alternatives, grounded in project reality
- Drop weak ones (work against why, ruled out by existing work)
- Sketch concretely: what each trades off
- Recommend one with reason
- Ask which way to go
- If genuinely one sensible way: say so, explain why others don't fit, present short design

### 1.4 Design Doc (After Approach Picked)

**Write to:** `docs/whizbang/YYYY-MM-DD-<topic>-design.md`

**Structure:**
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

**Hard Gate:** Nothing gets built until human **approves this doc**. Exceptions: opted out of questions, or spike they approved.

### 1.5 Builder Check (For Projects)

Dispatch fresh subagent with `builder-check-prompt.md` (see below). Sort findings:
- **Answered** → put in doc
- **Minor** → settle yourself, mark as your call
- **Theirs** → bring to human, update doc, hand over with your calls listed

---

## Phase 2: Planning — Implementation Plan

**Goal:** Produce approved **Plan** at `docs/whizbang/plans/YYYY-MM-DD-<topic>-plan.md`.

### 2.1 Plan Header (Mandatory)

```markdown
# <Feature> Implementation Plan

> **For agentic workers:** Use whizbang Phase 3 execution. Steps use `- [ ]` syntax.

**Goal:** [One sentence]

**Architecture:** [2-3 sentences on approach]

**Tech Stack:** [Key tech/libraries]

**Spec:** [path to design doc above]

## Global Constraints
[Exact values from design doc — version floors, dep limits, naming, platform]

## Review Focus
[5 input classes/failure modes spec implies but tasks don't exercise — most likely first]
1. ...
2. ...
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
> I recommend **<one>** because <one sentence from plan: task coupling, count, mistake cost>.
> 
> Does plan capture what you want, and which approach?

**If subagent-driven chosen:** Proceed to Phase 3 with subagent delegation.
**If native chosen:** Proceed to Phase 3 inline.

---

## Phase 3: Execution — Step-by-Step Implementation

### 3.1 Shared Setup (Both Modes)

```bash
# Workspace & ledger
PLAN_FILE="docs/whizbang/plans/<plan-file>.md"
WORKSPACE=$(bash scripts/sdd-workspace "$PLAN_FILE")  # prints .superpowers/sdd/<plan>/
LEDGER="$WORKSPACE/progress.md"

# Ledger identity
echo "# Whizbang ledger — plan: $PLAN_FILE" > "$LEDGER"

# Resume check
if grep -q "^# Whizbang ledger" "$LEDGER" 2>/dev/null; then
  grep "Task [0-9]*: complete" "$LEDGER"  # completed tasks = DONE, skip
fi

# Pre-flight conflict scan
# For each task consuming earlier task's output: ledger row with tasks, interface, finding
# Rule conflicts with spec as authority, record as "Task N: Ruling: ..."
```

### 3.2 Mode A: Subagent-Driven (Recommended)

**Per Task Loop:**

```
1. DISPATCH IMPLEMENTER
   - BASE=$(git rev-parse HEAD)
   - brief=$(bash scripts/task-brief "$PLAN_FILE" N)  → prints brief path
   - Dispatch implementer subagent with:
     * One line: where task fits
     * Brief path: "read this first — your requirements, exact values"
     * Interfaces/decisions from earlier tasks
     * Your resolution of any ambiguity
     * Report file path (brief → report: task-N-brief.md → task-N-report.md)
     * No-subagents contract (implementer never spawns helpers/reviewers)

2. HANDLE REPORT
   - DONE → generate review package → dispatch task reviewer
   - DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED → read handling-reports.md
   - Questions → answer fully, don't rush

3. TASK REVIEW (per-task gate)
   - review-pkg=$(bash scripts/review-package "$PLAN_FILE" BASE HEAD)
   - Dispatch reviewer with: brief, report, review-pkg, global constraints
   - Reviewer MUST give: spec ✅/❌ AND quality verdict
   - ❌/Critical/Important → fix loop (max 3 rounds, then park with ruling)
   - Read fix-loop.md before every round

4. COMPLETE TASK
   - Clean review OR parked at cap → ledger append:
     "Task N: complete (commits <base7>..<head7>, review clean)"
   - OR "Task N: complete (commits <base7>..<head7>, K parked)"
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
   - brief=$(bash scripts/task-brief "$PLAN_FILE" N) → read brief
   - Mark todo in_progress

2. WORK STEPS (TDD — load test-driven-development first)
   - Steps already in RED-GREEN order
   - Write test → run (verify fail) → implement minimal → run (verify pass)
   - Every step with Expected: line → run command → compare output
   - Three outcomes: Match / Code wrong (systematic-debugging) / Plan wrong (Rule + ledger)
   - Commit as plan says

3. COMPLETION CONTRACT (verification-before-completion)
   - All brief-named tests exist, ran, you read output
   - Final task test run PASS (command + result in ledger)
   - Every Expected: compared
   - Every deviation → Ruling: line in ledger

4. TASK DONE
   - bash scripts/task-done "$PLAN_FILE" N BASE -- <test-cmd>
   - Appends: "Task N: complete (commits <base7>..<head7>, tests: <cmd> → <result>)"
   - Mark todo complete
```

**Final Review (Both Modes):**
- review-pkg=$(bash scripts/review-package "$PLAN_FILE" MERGE_BASE HEAD)
- Dispatch reviewer on most capable model with code-reviewer.md
- Re-grade findings by effect (not spec silence)
- Critical/Important → ONE fix pass each (TDD: test RED→GREEN, suite green)
- Minor → ledger as "Final: minor (deferred): ..."
- Declined to judge → your ruling with cost-if-wrong
- Collect all Ruling: lines for final message

---

## Phase 4: Completion — Verified Finish

**Run finishing-a-development-branch workflow:**

1. **Verify full test suite** — must pass
2. **Detect environment** (GIT_DIR vs GIT_COMMON, branch state)
3. **Confirm base branch** — "Split from <branch>, correct?"
4. **Present options:**
   - Normal/named branch: 1) Merge locally 2) Push + PR 3) Keep as-is
   - Detached HEAD: 1) Push as new branch + PR 2) Keep as-is
5. **Execute choice** — merge (verify tests on merged), push+PR, or keep
6. **Cleanup** — worktree removal (only for merge/discard, only `.worktrees/` owned)

**Final Message Includes:**
- Rulings made (with cost if wrong)
- Deferred minors
- Worktree/branch status

---

## Supporting Artifacts

### Builder Check Prompt (`builder-check-prompt.md`)

```
You are a senior engineer reviewing a design doc for implementability.
Read the design doc at <path>. The spec is at <spec-path>.

Check for:
1. Missing information a builder would need to start
2. Ambiguities that would cause wrong implementation
3. Assumptions that may not hold in this codebase
4. Interface definitions that are incomplete

Return findings in three piles:
- ANSWERED: Already in conversation/project — cite where
- MINOR: Sensible builder could settle — propose resolution
- THEIRS: Only human partner can answer, changes what gets built

Be thorough but concise. No style nits.
```

### Implementer Prompt Template

```
Task N of <plan>: <Component Name>

CONTEXT: <one line where this fits in project>

READ THIS FIRST — YOUR REQUIREMENTS: <brief-path>
It contains exact values, signatures, test cases. Use verbatim.

INTERFACES FROM EARLIER TASKS:
<consumes block from plan>

MY RESOLUTIONS:
<ambiguity resolutions>

REPORT FILE: <report-path>
Write full report there. Return only: status, commits, one-line test summary, concerns.

CONTRACT: No subagents. No helpers. No reviewer. You implement, test, commit, self-review.
```

### Task Reviewer Prompt Template

```
Review Task N: <Component Name>

INPUTS:
- Brief: <brief-path>
- Implementer report: <report-path>
- Diff package: <review-pkg-path>
- Global constraints: <verbatim from plan>

VERDICTS REQUIRED:
1. SPEC COMPLIANCE: ✅ or ❌ (with specific gaps)
2. TASK QUALITY: ✅ or ❌ (code quality, test hygiene, YAGNI)

Findings format:
- CRITICAL: <what> — <why it breaks spec/user> — <file:line>
- IMPORTANT: <what> — <impact> — <file:line>
- MINOR: <what> — <polish> — <file:line>
- CANNOT VERIFY: <what> — <why> — <file:line>

No "do not flag" pre-judging. If you think something's a false positive, flag it and let controller adjudicate.
```

---

## Red Flags — Stop and Fix

| Thought | Reality |
|---------|---------|
| "Just a simple question" | Questions are tasks. Check phase gates. |
| "Skip discovery, they know what they want" | They usually don't. Design doc gate exists for reason. |
| "Plan is obvious, write code" | Plan is the thinking. Code is transcription. |
| "Test passes, ship it" | Watch it FAIL first. Red-green is the contract. |
| "Review slows me down" | Unreviewed code is how bugs ship. Review is brakes. |
| "Ledger is overhead" | Ledger survives compaction. Context doesn't. |
| "Fix the minor too" | Every unasked fix = test + fix + suite run they didn't request. |

---

## Quick Reference Card

| Phase | Gate | Artifact | Human Action |
|-------|------|----------|--------------|
| 0 Setup | Tests pass | Worktree ready | Consent to create |
| 1 Discovery | Design doc approved | `docs/whizbang/...-design.md` | Approve design |
| 2 Planning | Plan self-reviewed | `docs/whizbang/plans/...-plan.md` | Approve plan + choose execution |
| 3 Execution | Task review clean | Ledger entries, commits | None (continuous) |
| 4 Completion | Full suite + final review | Merged/PR/kept branch | Choose integration |

---

## Builder Check Prompt (Reference)

Save as `.whizbang/builder-check-prompt.md` in skill dir:

```
You are a senior engineer reviewing a design doc for implementability.
Read the design doc at {DESIGN_PATH}. The spec is at {SPEC_PATH}.

Check for:
1. Missing information a builder would need to start
2. Ambiguities that would cause wrong implementation
3. Assumptions that may not hold in this codebase
4. Interface definitions that are incomplete

Return findings in three piles:
- ANSWERED: Already in conversation/project — cite where
- MINOR: Sensible builder could settle — propose resolution
- THEIRS: Only human partner can answer, changes what gets built

Be thorough but concise. No style nits.
```

---

## Visual Companion Offer (Just-in-Time)

When a question would be better understood visually (screen, layout, flow, options, diagram):

> "This might be easier if I show you. Want me to open a browser tab with some mockups?"

If accepted, read `visual-companion.md` and serve mockups/prototypes.

---

## Spike Protocol

- Offer when cheap way to learn what they want or if something works
- No tests/minimal, not bulletproof, skip plan/implementation/review
- Label throwaway explicitly
- Bringing spike output back = new request through discovery gate
- "Or if you'd rather I just dive in" = opt-out, skill done, normal workflow

---

## Rationalization Table

| Excuse | Whizbang Response |
|--------|-------------------|
| "Too simple for discovery" | Discovery is fast for simple things. Gate catches misalignment early. |
| "Emergency, no time" | Systematic is faster than thrashing. Phase 0-1 take minutes. |
| "I'll test after" | Test-after proves nothing. Red-green proves the test catches the bug. |
| "Plan is wrong, I'll fix" | Rule + ledger. Unledgered deviation = secret decision. |
| "Review later" | Per-task review catches interface breaks before they cascade. |
| "Keep as reference" | Delete means delete. Adaptation = test-after. |

---

## Command Reference

| Purpose | Command |
|---------|---------|
| Create worktree | `git worktree add .worktrees/<branch> -b <branch>` |
| Baseline tests | `npm test / cargo test / pytest / go test ./...` |
| Task brief | `bash scripts/task-brief PLAN_FILE N` |
| Review package | `bash scripts/review-package PLAN_FILE BASE HEAD` |
| Task done | `bash scripts/task-done PLAN_FILE N BASE -- <test-cmd>` |
| SDD workspace | `bash scripts/sdd-workspace PLAN_FILE` |

---

## Integration with Existing Skills

**Whizbang subsumes/replaces:**
- `planner` → Phase 2 (enhanced with interfaces, review focus, self-review)
- `test-writing` → Phase 3 TDD (iron law, red-green-refactor, verification)
- `debugging` → `systematic-debugging` in Phase 3 (4-phase, 3-fail → architecture)
- `verification-before-completion` → Phase 3 completion contract + Phase 4
- `finishing-a-development-branch` → Phase 4
- `subagent-driven-development` / `executing-plans` → Phase 3 both modes
- `brainstorming` → Phase 1
- `writing-plans` → Phase 2
- `using-git-worktrees` → Phase 0
- `dispatching-parallel-agents` → Available in Phase 3 for independent sub-tasks
- `requesting-code-review` / `receiving-code-review` → Phase 3 task review + final review

**Whizbang coexists with:**
- `analyzer`, `audit`, `optimizer` (code analysis — different purpose)
- `no-slop`, `documentation` (writing — different purpose)
- `freelance-bid-analyzer`, `open-source-advisor` (advisory — different purpose)
- `absolute-mode`, `combo`, `simplifier` (behavioral/meta — different purpose)
- `skill-authoring` (meta — for creating skills like this one)

---

## Minimal Viable Whizbang (If Context Tight)

If you must compress, keep this skeleton:

1. **Discover** → Design doc (approved)
2. **Plan** → Tasks with interfaces + test signatures (approved)
3. **Execute** → Per task: test fail → minimal code → test pass → commit → ledger
4. **Verify** → Full suite → final review → merge/PR

**Never drop:** Design doc gate, TDD cycle, ledger, final review.