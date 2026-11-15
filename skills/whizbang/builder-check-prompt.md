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