#!/usr/bin/env python3
"""Curly benchmark runner: command mode and Python function mode.

Measures before/after with statistics (median, p95, min, noise %, peak RSS)
and an optional equality check.

    python3 bench.py --cmd "<cmd>" --vs "<cmd>" --runs 8
    python3 bench.py --module old.py --func dedupe --vs-module new.py --vs-func dedupe --setup args.py --runs 8 --check-equal
"""
import argparse
import json
import subprocess
import sys
import time
import importlib.util
from pathlib import Path


def median(xs):
    s = sorted(xs)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def p95(xs):
    s = sorted(xs)
    return s[max(0, int(len(s) * 0.95) - 1)] if s else 0


def mean(xs):
    return sum(xs) / len(xs) if xs else 0


def stddev(xs):
    m = mean(xs)
    return (sum((x - m) ** 2 for x in xs) / max(1, len(xs) - 1)) ** 0.5


def peak_rss_mb():
    try:
        with open("/proc/self/status") as fh:
            for line in fh:
                if line.startswith("VmHWM:"):
                    return int(line.split()[1]) / 1024
    except OSError:
        pass
    return 0.0


def now_us():
    return time.perf_counter() * 1e6


def run_cmd(cmd, runs):
    times = []
    for _ in range(runs):
        t0 = now_us()
        subprocess.run(cmd, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        times.append(now_us() - t0)
    return times


def load_fn(module_path, func_name):
    spec = importlib.util.spec_from_file_location("curly_bench_mod", module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    fn = getattr(mod, func_name, None)
    if fn is None:
        fn = getattr(mod, "default", None)
    if not callable(fn):
        raise ValueError(f"callable {func_name!r} not found in {module_path}")
    return fn


def run_fn(module_path, func_name, setup_path, runs):
    fn = load_fn(module_path, func_name)
    setup = None
    if setup_path:
        spec = importlib.util.spec_from_file_location("curly_bench_setup", setup_path)
        smod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(smod)
        setup = getattr(smod, "setup", None)
    times = []
    results = []
    for _ in range(runs):
        args = setup() if callable(setup) else ()
        args = args if isinstance(args, (list, tuple)) else [args]
        t0 = now_us()
        res = fn(*args)
        times.append(now_us() - t0)
        results.append(res)
    return times, results


def fmt_us(t):
    return f"{t / 1000:.3f}ms" if t >= 1000 else f"{t:.3f}us"


def verdict(pct, noise_a, noise_b):
    tol = max(noise_a, noise_b, 5.0)
    if abs(pct) <= tol:
        return "no significant change"
    if pct > 0:
        return f"FASTER by {pct:.1f}%"
    return f"SLOWER by {-pct:.1f}%"


def bench_cmd(cmd_a, cmd_b, runs):
    t_a = run_cmd(cmd_a, runs)
    t_b = run_cmd(cmd_b, runs)
    med_a, med_b = median(t_a), median(t_b)
    na, nb = (stddev(t_a) / max(med_a, 1)) * 100, (stddev(t_b) / max(med_b, 1)) * 100
    pct = ((med_a - med_b) / med_a * 100) if med_a else 0
    ratio = med_a / med_b if med_b else 0
    print(f"{cmd_a}   median {fmt_us(med_a)} p95 {fmt_us(p95(t_a))} min {fmt_us(min(t_a))} noise +/-{na:.1f}% n={runs} peakRSS {peak_rss_mb():.2f}MiB")
    print(f"{cmd_b}   median {fmt_us(med_b)} p95 {fmt_us(p95(t_b))} min {fmt_us(min(t_b))} noise +/-{nb:.1f}% n={runs} peakRSS {peak_rss_mb():.2f}MiB")
    print(f"{cmd_a} -> {cmd_b}: {verdict(pct, na, nb)} (x{ratio:.2f})")
    return 0


def bench_fn(mod_a, fn_a, mod_b, fn_b, setup, runs, check_equal):
    t_a, r_a = run_fn(mod_a, fn_a, setup, runs)
    t_b, r_b = run_fn(mod_b, fn_b, setup, runs)
    med_a, med_b = median(t_a), median(t_b)
    na, nb = (stddev(t_a) / max(med_a, 1)) * 100, (stddev(t_b) / max(med_b, 1)) * 100
    pct = ((med_a - med_b) / med_a * 100) if med_a else 0
    ratio = med_a / med_b if med_b else 0
    equal = json.dumps(r_a[0]) == json.dumps(r_b[0]) if r_a and r_b else None
    if check_equal and equal is False:
        print("results NOT equal across versions", file=sys.stderr)
        return 1
    print(f"{mod_a}:{fn_a}   median {fmt_us(med_a)} p95 {fmt_us(p95(t_a))} min {fmt_us(min(t_a))} noise +/-{na:.1f}% n={runs}")
    print(f"{mod_b}:{fn_b}   median {fmt_us(med_b)} p95 {fmt_us(p95(t_b))} min {fmt_us(min(t_b))} noise +/-{nb:.1f}% n={runs}")
    eq_txt = "[results equal]" if equal is True else ("[results differ]" if equal is False else "")
    print(f"{mod_a}:{fn_a} -> {mod_b}:{fn_b}: {verdict(pct, na, nb)} (x{ratio:.2f}) {eq_txt}")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Curly benchmark runner")
    ap.add_argument("--cmd")
    ap.add_argument("--vs")
    ap.add_argument("--module")
    ap.add_argument("--func")
    ap.add_argument("--vs-module")
    ap.add_argument("--vs-func")
    ap.add_argument("--setup")
    ap.add_argument("--runs", type=int, default=8)
    ap.add_argument("--check-equal", action="store_true")
    args = ap.parse_args()

    if args.cmd and args.vs:
        return bench_cmd(args.cmd, args.vs, args.runs)
    if args.module and args.vs_module:
        return bench_fn(args.module, args.func or "run", args.vs_module, args.vs_func or "run", args.setup, args.runs, args.check_equal)
    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
