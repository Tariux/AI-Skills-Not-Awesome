# Fix Loop Reference

Part of whizbang-execute. The task review reported spec ❌, Critical/Important finding, or ⚠️ confirmed gap.

**Routes that exit immediately:**
- Minor findings → ledger as `Task <N>: minor (deferred): <one-liner>` → final review triages
- Plan-mandated conflicts → rule against plan text, ledger ruling, proceed

**Everything else enters the loop. Max 5 rounds per task:**

**Rounds 1-3:** Resume original implementer (or fresh with brief + report + findings). It fixes, re-runs covering tests, appends to report.

**Rounds 4-5:** Fresh implementer on more capable model with framing: "Prior implementer attempted N times; you own it now. Read report for what was tried."

**Every round:** Re-review scoped to fix diff (`review-package FIX_BASE HEAD`). New breakage in fix diff joins open findings. Out-of-scope → deferred minors.

**After each round, ledger:**
`Task <N>: fix round <R>/5 (<X> addressed, <Y> open; commits <a7>..<b7>)`

**Breaker (round 5 still open):** Adjudicate each:
- Reviewer wrong/contestable → park with ruling
- Real but not load-bearing → park with ruling
- Real and load-bearing → rule on smallest unblocking change, ledger, carry to next task

**Never fix findings yourself in controller session.** Controller fixes skip review.