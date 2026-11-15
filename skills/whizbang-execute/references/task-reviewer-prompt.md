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