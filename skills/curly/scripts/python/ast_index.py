#!/usr/bin/env python3
"""Curly Python AST indexer: design fingerprints for precedent matching.

Produces a JSON index of functions/modules with control-flow signatures used
by the matcher to find the closest existing design.
"""
import ast
import json
import sys
from pathlib import Path


def fingerprint(src):
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return {"error": "syntax"}
    branches = loops = nesting = max_nesting = max_loop = cur_loop = 0
    has_await = "await" in src
    has_map = "Map" in src or "dict" in src or "{}" in src
    has_set = "set(" in src or "set()" in src
    has_filter = ".filter(" in src
    has_find = ".find(" in src
    has_reduce = ".reduce(" in src

    class V(ast.NodeVisitor):
        def __init__(self):
            self.branches = self.loops = self.nesting = self.max_nesting = self.max_loop = self.cur_loop = 0

        def visit_If(self, node):
            self.branches += 1
            self.nesting += 1
            self.max_nesting = max(self.max_nesting, self.nesting)
            self.generic_visit(node)
            self.nesting -= 1

        def visit_For(self, node):
            self.loops += 1
            self.cur_loop += 1
            self.max_loop = max(self.max_loop, self.cur_loop)
            self.nesting += 1
            self.max_nesting = max(self.max_nesting, self.nesting)
            self.generic_visit(node)
            self.nesting -= 1
            self.cur_loop -= 1

        def visit_While(self, node):
            self.loops += 1
            self.cur_loop += 1
            self.max_loop = max(self.max_loop, self.cur_loop)
            self.nesting += 1
            self.max_nesting = max(self.max_nesting, self.nesting)
            self.generic_visit(node)
            self.nesting -= 1
            self.cur_loop -= 1

        def visit_Try(self, node):
            self.branches += 1
            self.nesting += 1
            self.max_nesting = max(self.max_nesting, self.nesting)
            self.generic_visit(node)
            self.nesting -= 1

    v = V()
    v.visit(tree)
    return {"branches": v.branches, "loops": v.loops, "maxNesting": v.max_nesting, "maxLoopDepth": v.max_loop,
            "hasAwait": has_await, "hasMap": has_map, "hasSet": has_set, "hasFilter": has_filter,
            "hasFind": has_find, "hasReduce": has_reduce}


def main():
    files = sys.argv[1:]
    index = []
    for f in files:
        p = Path(f)
        if not p.is_file():
            continue
        try:
            src = p.read_text(encoding="utf-8")
        except OSError:
            continue
        index.append({"file": str(p), "language": "py" if p.suffix == ".py" else "js", "fingerprint": fingerprint(src)})
    print(json.dumps(index, indent=2))


if __name__ == "__main__":
    main()
