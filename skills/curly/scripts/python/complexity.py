#!/usr/bin/env python3
"""Curly Python complexity engine (stdlib ast, fallback-safe, cached).

Per-function: cyclomatic, cognitive (nesting-weighted), max nesting, max loop
depth (Big-O upper bound), LOC, params, and perf smells
(nested-loop, linear-search-in-loop, io-in-loop, await-in-loop,
spread-accumulator, list-concat-in-loop, string-concat-in-loop,
regex-compile-in-loop).

    python3 complexity.py src/                       # scan a tree
    python3 complexity.py --changed                  # only files changed vs HEAD
    python3 complexity.py --budget cyclomatic=8,cognitive=12 --json
    python3 complexity.py --changed --fail-on-budget # exit 1 when over budget
"""
import argparse
import ast
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
NODE_ENGINE = HERE.parent / "node" / "complexity.mjs"
PY_EXT = {".py"}
JS_EXT = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"}

DEFAULT_BUDGET = {"cyclomatic": 10, "cognitive": 15, "nesting": 4, "loopDepth": 2, "loc": 60, "params": 5}

SMELL_IDS = [
    "nested-loop", "linear-search-in-loop", "io-in-loop", "await-in-loop",
    "spread-accumulator", "list-concat-in-loop", "string-concat-in-loop", "regex-compile-in-loop",
]


def big_o(depth):
    if depth <= 1:
        return "O(n)"
    if depth == 2:
        return "O(n^2)"
    if depth == 3:
        return "O(n^3)"
    return f"O(n^{depth})"


def parse_budget(s):
    b = dict(DEFAULT_BUDGET)
    if not s:
        return b
    for part in s.split(","):
        k, _, v = part.partition("=")
        if k and v:
            try:
                b[k.strip()] = int(v)
            except ValueError:
                pass
    return b


def list_files(inputs, ignores=None):
    ignores = ignores or ["node_modules", ".curly", ".git", "dist", "build"]
    import re
    ignore_re = re.compile("|".join(
        i.replace(".", r"\.").replace("*", ".*") for i in ignores
    )) if ignores else None
    files = []
    seen = set()

    def visit(p):
        try:
            if p.is_dir():
                for child in sorted(p.iterdir()):
                    if child.name.startswith("."):
                        continue
                    visit(child)
                return
        except OSError:
            return
        ext = p.suffix
        if ext in PY_EXT or ext in JS_EXT:
            rel = str(p)
            if ignore_re and ignore_re.search(rel):
                return
            if str(p) not in seen:
                seen.add(str(p))
                files.append(str(p))

    for inp in inputs:
        visit(Path(inp).resolve())
    return files


def read_file(p):
    try:
        return Path(p).read_text(encoding="utf-8")
    except OSError:
        return None


def git_changed(base=None):
    args = ["git", "diff", "--name-only"]
    if base:
        args = ["git", "diff", "--name-only", f"{base}...HEAD"]
    try:
        out = subprocess.check_output(args, text=True, cwd=Path.cwd())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    return [l for l in out.splitlines() if l.strip()]


def count_params(node):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        args = node.args
        return (len(args.args) + len(args.posonlyargs) + len(args.kwonlyargs)
                + (1 if args.vararg else 0) + (1 if args.kwarg else 0))
    if isinstance(node, ast.Lambda):
        return len(node.args.args)
    return 0


def count_loc(node):
    return (getattr(node, "end_lineno", node.lineno) or node.lineno) - node.lineno + 1


class ComplexityVisitor(ast.NodeVisitor):
    def __init__(self, src_lines):
        self.src_lines = src_lines
        self.functions = []
        self._stack = []

    def _new_frame(self, node):
        return {
            "cyclomatic": 1,
            "cognitive": 0,
            "nesting": 0,
            "maxNesting": 0,
            "loopDepth": 0,
            "maxLoopDepth": 0,
            "smells": [],
        }

    def visit_FunctionDef(self, node):
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node):
        self._visit_function(node)

    def visit_Lambda(self, node):
        self._visit_function(node)

    def _visit_function(self, node):
        frame = self._new_frame(node)
        self._stack.append(frame)
        self.generic_visit(node)
        self._stack.pop()
        f = {
            "name": getattr(node, "name", "lambda") or "lambda",
            "file": "",
            "line": node.lineno,
            "end": getattr(node, "end_lineno", node.lineno),
            "loc": count_loc(node),
            "params": count_params(node),
            "cyclomatic": frame["cyclomatic"],
            "cognitive": frame["cognitive"],
            "maxNesting": frame["maxNesting"],
            "maxLoopDepth": frame["maxLoopDepth"],
            "bigO": big_o(frame["maxLoopDepth"]),
            "smells": frame["smells"],
            "engine": "ast",
            "language": "py",
        }
        self.functions.append(f)

    def _enter(self, kind):
        frame = self._stack[-1]
        frame["nesting"] += 1
        frame["maxNesting"] = max(frame["maxNesting"], frame["nesting"])
        frame["cyclomatic"] += 1
        frame["cognitive"] += 1 + frame["nesting"]
        if kind == "loop":
            frame["loopDepth"] += 1
            frame["maxLoopDepth"] = max(frame["maxLoopDepth"], frame["loopDepth"])

    def _exit(self, kind):
        frame = self._stack[-1]
        if kind == "loop":
            frame["loopDepth"] -= 1
        frame["nesting"] -= 1

    def visit_If(self, node):
        self._enter("branch")
        self.generic_visit(node)
        self._exit("branch")

    def visit_For(self, node):
        self._enter("loop")
        self._check_smells(node)
        self.generic_visit(node)
        self._exit("loop")

    def visit_While(self, node):
        self._enter("loop")
        self._check_smells(node)
        self.generic_visit(node)
        self._exit("loop")

    def visit_Try(self, node):
        self._enter("branch")
        self.generic_visit(node)
        self._exit("branch")

    def visit_ExceptHandler(self, node):
        self._enter("branch")
        self.generic_visit(node)
        self._exit("branch")

    def visit_BoolOp(self, node):
        frame = self._stack[-1]
        frame["cyclomatic"] += len(node.values) - 1
        frame["cognitive"] += len(node.values) - 1
        self.generic_visit(node)

    def visit_IfExp(self, node):
        frame = self._stack[-1]
        frame["cyclomatic"] += 1
        frame["cognitive"] += 1 + frame["nesting"]
        self.generic_visit(node)

    def _check_smells(self, node):
        frame = self._stack[-1]
        start = node.lineno - 1
        end = getattr(node, "end_lineno", start) - 1
        body = "\n".join(self.src_lines[start:end])
        self._scan_smells(body, node.lineno, frame["smells"])

    def _scan_smells(self, body, line_base, smells):
        lines = body.split("\n")
        seen = set()
        for i, line in enumerate(lines):
            line_no = line_base + i
            low = line.strip()
            key = msg = sev = None
            if any(k in low for k in ("for ", "while ")) and i > 0:
                key, msg, sev = "nested-loop", "Nested iteration is O(n*m). Index once (dict/set) outside the outer loop.", "warn"
            elif any(m in low for m in (".includes(", ".indexOf(", ".find(")):
                key, msg, sev = "linear-search-in-loop", "Linear search inside a loop is O(n*m). Convert to a set/dict once, outside the loop.", "warn"
            elif "await " in low:
                key, msg, sev = "await-in-loop", "Sequential awaits in a loop. Batch if independent.", "info"
            elif any(m in low for m in ("console.", "fetch(", "fs.", "readFile", "query(")):
                key, msg, sev = "io-in-loop", "I/O inside a loop. Batch or move outside.", "info"
            elif any(m in low for m in ("[...", "{...")):
                key, msg, sev = "spread-accumulator", "Copying the accumulator each iteration is O(n^2). Mutate one object instead.", "warn"
            elif ".concat(" in low or ("=" in low and "[" in low and "]" in low and "+" in low):
                key, msg, sev = "list-concat-in-loop", "List concat copies every iteration (O(n^2)). Use append/extend.", "warn"
            elif any(m in low for m in ("+=", "= ")) and ("'" in low or '"' in low):
                key, msg, sev = "string-concat-in-loop", "String += in a loop. Collect parts and join once.", "info"
            elif "RegExp(" in low or ("/" in low and low.endswith("/")):
                key, msg, sev = "regex-compile-in-loop", "Regex compiled each iteration. Hoist to a module constant.", "info"
            if key:
                k = key + ":" + str(line_no)
                if k not in seen:
                    seen.add(k)
                    smells.append({"id": key, "line": line_no, "severity": sev, "msg": msg, "confidence": 0.7})


def analyse_python(path):
    src = read_file(path)
    if src is None:
        return {"path": path, "language": "py", "functions": [], "engine": "ast", "error": "unreadable"}
    src_lines = src.splitlines()
    try:
        tree = ast.parse(src, filename=path)
    except SyntaxError as e:
        return {"path": path, "language": "py", "functions": [], "engine": "ast", "error": str(e)}
    visitor = ComplexityVisitor(src_lines)
    visitor.visit(tree)
    for f in visitor.functions:
        f["file"] = path
    return {"path": path, "language": "py", "functions": visitor.functions, "engine": "ast", "fallback": False}


def analyse_file(path):
    p = Path(path)
    ext = p.suffix
    if ext in PY_EXT:
        return analyse_python(str(p))
    return {"path": str(p), "language": "js", "functions": [], "engine": "node-delegate",
            "note": "JS/TS handled by scripts/node/complexity.mjs"}


def json_result(tool, files, opts=None):
    engines = sorted({f["engine"] for f in files})
    summary = {
        "files": len(files),
        "functions": sum(len(f["functions"]) for f in files),
        "overBudget": 0,
        "smells": sum(sum(len(fn["smells"]) for fn in f["functions"]) for f in files),
        "engines": engines,
        "budget": opts.get("budget", DEFAULT_BUDGET) if opts else DEFAULT_BUDGET,
    }
    return {"tool": tool, "version": "3.0.0", **(opts or {}), "files": files, "summary": summary}


def main():
    ap = argparse.ArgumentParser(description="Curly Python complexity engine")
    ap.add_argument("inputs", nargs="*")
    ap.add_argument("--changed", action="store_true")
    ap.add_argument("--base", default=None)
    ap.add_argument("--budget", default=None)
    ap.add_argument("--fail-on-budget", action="store_true")
    ap.add_argument("--fail-on-regression", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    budget = parse_budget(args.budget)
    fail = args.fail_on_budget or args.fail_on_regression

    if args.changed:
        inputs = git_changed(args.base)
    else:
        inputs = args.inputs
    if not inputs:
        if args.json:
            print(json.dumps(json_result("complexity", [], {"budget": budget, "error": "no input files"}), indent=2))
        else:
            print("curly complexity: no input files found", file=sys.stderr)
        return 1

    files = list_files(inputs)
    results = []
    total_funcs = 0
    over_budget = 0

    for f in files:
        res = analyse_file(f)
        results.append(res)
        total_funcs += len(res["functions"])
        ob = 0
        for fn in res["functions"]:
            if (fn["cyclomatic"] > budget["cyclomatic"] or fn["cognitive"] > budget["cognitive"]
                    or fn["maxNesting"] > budget["nesting"] or fn["maxLoopDepth"] > budget["loopDepth"]
                    or fn["loc"] > budget["loc"] or fn["params"] > budget["params"]):
                ob += 1
        over_budget += ob
        res["overBudget"] = ob
        res["smellCount"] = sum(len(fn["smells"]) for fn in res["functions"])
        if args.json:
            continue
        print(f"{res['path']}: {len(res['functions'])} function(s); smells={res['smellCount']}; overBudget={ob}")
        for fn in res["functions"]:
            flag = " OVER_BUDGET" if (fn["cyclomatic"] > budget["cyclomatic"] or fn["cognitive"] > budget["cognitive"]
                or fn["maxNesting"] > budget["nesting"] or fn["maxLoopDepth"] > budget["loopDepth"]
                or fn["loc"] > budget["loc"] or fn["params"] > budget["params"]) else ""
            print(f"  {fn['line']}:{fn['end']} {fn['name']} cyc={fn['cyclomatic']} cog={fn['cognitive']} nest={fn['maxNesting']} loops={fn['maxLoopDepth']}({fn['bigO']}) loc={fn['loc']} params={fn['params']}{flag}")
            for s in fn["smells"]:
                print(f"    {s['severity'].upper():4} {s['id']} @{s['line']}: {s['msg']}")

    if args.json:
        out = json_result("complexity", results, {"budget": budget})
        out["summary"]["overBudget"] = over_budget
        print(json.dumps(out, indent=2))
    else:
        eng = ", ".join(sorted({r["engine"] for r in results}))
        print(f"\ncurly complexity: {len(results)} file(s), {total_funcs} function(s); engines {eng}")
        print(f"budget: cyclomatic<={budget['cyclomatic']} cognitive<={budget['cognitive']} nesting<={budget['nesting']} loopDepth<={budget['loopDepth']} loc<={budget['loc']} params<={budget['params']}")
        print(f"over budget: {over_budget} function(s)")

    if fail and over_budget > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
