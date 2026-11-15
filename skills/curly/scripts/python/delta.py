#!/usr/bin/env python3
"""Curly delta: before/after complexity delta and regression detection.

Compares two complexity result sets (before/after) and reports per-function
deltas plus an overall regression verdict.

    python3 delta.py before.json after.json [--fail-on-regression]
"""
import json
import sys


def key(fn):
    return f"{fn['file']}:{fn['name']}@{fn['line']}"


def _functions(obj):
    """Flatten functions from a complexity JSON result (dict or list)."""
    if isinstance(obj, list):
        out = []
        for item in obj:
            out.extend(_functions(item))
        return out
    if isinstance(obj, dict):
        if "results" in obj and isinstance(obj["results"], list):
            out = []
            for r in obj["results"]:
                out.extend(_functions(r))
            return out
        if "files" in obj and isinstance(obj["files"], list):
            out = []
            for r in obj["files"]:
                out.extend(_functions(r))
            return out
        if "functions" in obj and isinstance(obj["functions"], list):
            return list(obj["functions"])
    return []


def main():
    if len(sys.argv) < 3:
        print("usage: python3 delta.py before.json after.json [--fail-on-regression]", file=sys.stderr)
        return 1
    before_path, after_path = sys.argv[1], sys.argv[2]
    fail = "--fail-on-regression" in sys.argv

    try:
        with open(before_path) as fh:
            before = json.load(fh)
        with open(after_path) as fh:
            after = json.load(fh)
    except (OSError, json.JSONDecodeError) as e:
        print(f"cannot read input: {e}", file=sys.stderr)
        return 1

    b_map = {key(fn): fn for fn in _functions(before)}
    a_map = {key(fn): fn for fn in _functions(after)}

    regressions = []
    improvements = []
    for k, af in a_map.items():
        bf = b_map.get(k)
        if not bf:
            improvements.append((k, af, "new"))
            continue
        for metric in ("cyclomatic", "cognitive", "maxNesting", "maxLoopDepth", "loc", "params"):
            d = af.get(metric, 0) - bf.get(metric, 0)
            if d > 0:
                regressions.append((k, metric, bf.get(metric), af.get(metric), d))
            elif d < 0:
                improvements.append((k, metric, bf.get(metric), af.get(metric), d))

    print(f"delta: {len(b_map)} before functions, {len(a_map)} after functions")
    print(f"regressions: {len(regressions)}  improvements: {len(improvements)}")
    for k, metric, old, new, d in regressions[:10]:
        print(f"  REGRESS {k}: {metric} {old} -> {new} (+" + str(d) + ")")
    if fail and regressions:
        print("FAIL: regressions detected", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
