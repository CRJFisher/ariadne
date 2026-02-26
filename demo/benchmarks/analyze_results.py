#!/usr/bin/env python3
"""
Ariadne MCP Benchmark Analysis

Statistical analysis and visualization of benchmark results.

Primary analyses:
- McNemar's exact test for pass/fail rates + Wilson score 95% CIs
- Wilcoxon signed-rank test for token usage and cost + Hodges-Lehmann CIs
- Bootstrap 95% CIs for relative reduction percentages (10,000 iterations)

Visualizations:
- Paired bar chart: resolve rate with error bars
- Violin/box plot: per-task token usage by condition
- Forest plot: effect size by task subgroup

Usage:
    python analyze_results.py results/full_run.json --output RESULTS.md --plots results/
"""

import argparse
import json
import math
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np

try:
    from scipy import stats
except ImportError:
    print("scipy required: pip install scipy", file=sys.stderr)
    sys.exit(1)

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:
    plt = None  # type: ignore[assignment]
    print("matplotlib not found — plots will be skipped", file=sys.stderr)


PRICING = {
    "claude-sonnet-4-5-20250929": {
        "input_per_mtok": 3.0,
        "output_per_mtok": 15.0,
        "cache_read_per_mtok": 0.30,
        "cache_creation_per_mtok": 3.75,
    },
    "claude-sonnet-4-6-20250514": {
        "input_per_mtok": 3.0,
        "output_per_mtok": 15.0,
        "cache_read_per_mtok": 0.30,
        "cache_creation_per_mtok": 3.75,
    },
    "claude-opus-4-6-20250219": {
        "input_per_mtok": 15.0,
        "output_per_mtok": 75.0,
        "cache_read_per_mtok": 1.50,
        "cache_creation_per_mtok": 18.75,
    },
}


# ---------------------------------------------------------------------------
# Data loading and aggregation
# ---------------------------------------------------------------------------

def load_results(path: Path) -> dict:
    """Load benchmark results JSON."""
    return json.loads(path.read_text())


def aggregate_by_task(results: list[dict]) -> dict[str, dict]:
    """Aggregate multiple runs per task into majority-vote pass/fail and median metrics.

    Returns:
        {task_id: {
            "ariadne": {"passed": bool, "tokens": float, "cost": float, ...},
            "baseline": {"passed": bool, "tokens": float, "cost": float, ...},
        }}
    """
    # Group by (task_id, condition)
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in results:
        groups[(r["task_id"], r["condition"])].append(r)

    tasks: dict[str, dict] = {}
    for (task_id, condition), runs in groups.items():
        if task_id not in tasks:
            tasks[task_id] = {}

        # Majority vote for pass/fail (None = unevaluated, treated as fail)
        pass_votes = sum(1 for r in runs if r.get("passed") is True)
        fail_votes = len(runs) - pass_votes
        passed = pass_votes > fail_votes

        # Median for continuous metrics
        def median_of(key: str) -> float | None:
            vals = [r[key] for r in runs if r.get(key) is not None]
            return float(np.median(vals)) if vals else None

        total_tokens_list = []
        cost_list = []
        for r in runs:
            inp = r.get("input_tokens") or 0
            out = r.get("output_tokens") or 0
            cache_r = r.get("cache_read_tokens") or 0
            cache_c = r.get("cache_creation_tokens") or 0
            total_tokens_list.append(inp + out + cache_r + cache_c)

            cost = r.get("total_cost_usd")
            if cost is None:
                cost = compute_cost(r)
            cost_list.append(cost)

        tasks[task_id][condition] = {
            "passed": passed,
            "total_tokens": float(np.median(total_tokens_list)) if total_tokens_list else None,
            "cost_usd": float(np.median(cost_list)) if cost_list else None,
            "duration_ms": median_of("duration_ms"),
            "num_turns": median_of("num_turns"),
            "n_runs": len(runs),
        }

    return tasks


def compute_cost(result: dict) -> float:
    """Compute cost from token counts and model pricing."""
    model = result.get("model_id", "")
    pricing = PRICING.get(model)
    if pricing is None:
        return 0.0

    inp = (result.get("input_tokens") or 0) / 1_000_000
    out = (result.get("output_tokens") or 0) / 1_000_000
    cache_r = (result.get("cache_read_tokens") or 0) / 1_000_000
    cache_c = (result.get("cache_creation_tokens") or 0) / 1_000_000

    return (
        inp * pricing["input_per_mtok"]
        + out * pricing["output_per_mtok"]
        + cache_r * pricing["cache_read_per_mtok"]
        + cache_c * pricing["cache_creation_per_mtok"]
    )


# ---------------------------------------------------------------------------
# Statistical tests
# ---------------------------------------------------------------------------

@dataclass
class TestResult:
    name: str
    test_statistic: float | None
    p_value: float | None
    effect_size: float | None
    ci_low: float | None
    ci_high: float | None
    n: int
    interpretation: str


def wilson_ci(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score 95% confidence interval for a proportion."""
    if total == 0:
        return (0.0, 0.0)
    p = successes / total
    denominator = 1 + z**2 / total
    center = (p + z**2 / (2 * total)) / denominator
    spread = z * math.sqrt((p * (1 - p) + z**2 / (4 * total)) / total) / denominator
    return (max(0.0, center - spread), min(1.0, center + spread))


def mcnemar_test(tasks: dict[str, dict]) -> TestResult:
    """McNemar's exact test for paired binary outcomes (pass/fail rates).

    Compares whether the marginal probabilities of passing differ between conditions.
    """
    # Build contingency: (ariadne_pass, baseline_pass) pairs
    a = 0  # both pass
    b = 0  # ariadne pass, baseline fail (discordant)
    c = 0  # ariadne fail, baseline pass (discordant)
    d = 0  # both fail

    paired_tasks = [
        tid for tid, conds in tasks.items()
        if "ariadne" in conds and "baseline" in conds
    ]

    for tid in paired_tasks:
        ar = tasks[tid]["ariadne"]["passed"]
        bl = tasks[tid]["baseline"]["passed"]
        if ar and bl:
            a += 1
        elif ar and not bl:
            b += 1
        elif not ar and bl:
            c += 1
        else:
            d += 1

    n = len(paired_tasks)
    n_discordant = b + c

    # McNemar's exact test (binomial test on discordant pairs)
    if n_discordant == 0:
        p_value = 1.0
        statistic = 0.0
    else:
        # Two-sided binomial test: H0: P(b) = 0.5 among discordant pairs
        p_value = float(stats.binomtest(b, n_discordant, 0.5).pvalue)
        statistic = float((abs(b - c) - 1) ** 2 / (b + c)) if (b + c) > 0 else 0.0

    ariadne_pass = a + b
    baseline_pass = a + c
    ariadne_rate = ariadne_pass / n if n > 0 else 0
    baseline_rate = baseline_pass / n if n > 0 else 0
    effect = ariadne_rate - baseline_rate

    interpretation = interpret_result(p_value, effect, is_rate=True)

    return TestResult(
        name="McNemar's exact test (resolve rate)",
        test_statistic=statistic,
        p_value=p_value,
        effect_size=effect,
        ci_low=None,
        ci_high=None,
        n=n,
        interpretation=interpretation,
    )


def wilcoxon_test(
    tasks: dict[str, dict],
    metric: str,
    name: str,
) -> TestResult:
    """Wilcoxon signed-rank test for paired continuous outcomes."""
    paired = []
    for tid, conds in tasks.items():
        if "ariadne" in conds and "baseline" in conds:
            ar_val = conds["ariadne"].get(metric)
            bl_val = conds["baseline"].get(metric)
            if ar_val is not None and bl_val is not None:
                paired.append((ar_val, bl_val))

    n = len(paired)
    if n < 5:
        return TestResult(
            name=name,
            test_statistic=None,
            p_value=None,
            effect_size=None,
            ci_low=None,
            ci_high=None,
            n=n,
            interpretation=f"Insufficient paired data (n={n}, need >= 5)",
        )

    ariadne_vals = np.array([p[0] for p in paired])
    baseline_vals = np.array([p[1] for p in paired])
    diffs = ariadne_vals - baseline_vals

    # Remove zero differences (Wilcoxon requirement)
    nonzero_mask = diffs != 0
    if nonzero_mask.sum() < 2:
        return TestResult(
            name=name,
            test_statistic=None,
            p_value=None,
            effect_size=None,
            ci_low=None,
            ci_high=None,
            n=n,
            interpretation="All differences are zero",
        )

    result = stats.wilcoxon(ariadne_vals, baseline_vals)
    p_value = float(result.pvalue)

    # Hodges-Lehmann estimator: median of pairwise averages of differences
    walsh_avgs = []
    for i in range(n):
        for j in range(i, n):
            walsh_avgs.append((diffs[i] + diffs[j]) / 2)
    hodges_lehmann = float(np.median(walsh_avgs))

    # Relative effect (median reduction %)
    median_baseline = float(np.median(baseline_vals))
    relative_effect = (hodges_lehmann / median_baseline * 100) if median_baseline != 0 else None

    interpretation = interpret_result(p_value, hodges_lehmann, is_rate=False)

    return TestResult(
        name=name,
        test_statistic=float(result.statistic),
        p_value=p_value,
        effect_size=hodges_lehmann,
        ci_low=None,  # Computed via bootstrap below
        ci_high=None,
        n=n,
        interpretation=interpretation,
    )


def bootstrap_ci(
    tasks: dict[str, dict],
    metric: str,
    n_bootstrap: int = 10_000,
    seed: int = 42,
) -> tuple[float, float, float]:
    """Bootstrap 95% CI for relative reduction percentage.

    Returns (median_reduction_pct, ci_low_pct, ci_high_pct).
    """
    paired = []
    for tid, conds in tasks.items():
        if "ariadne" in conds and "baseline" in conds:
            ar_val = conds["ariadne"].get(metric)
            bl_val = conds["baseline"].get(metric)
            if ar_val is not None and bl_val is not None:
                paired.append((ar_val, bl_val))

    if len(paired) < 3:
        return (0.0, 0.0, 0.0)

    rng = np.random.RandomState(seed)
    paired_arr = np.array(paired)
    n = len(paired_arr)

    reductions = []
    for _ in range(n_bootstrap):
        idx = rng.randint(0, n, size=n)
        sample = paired_arr[idx]
        ar_median = np.median(sample[:, 0])
        bl_median = np.median(sample[:, 1])
        if bl_median != 0:
            reduction = (bl_median - ar_median) / bl_median * 100
            reductions.append(reduction)

    if not reductions:
        return (0.0, 0.0, 0.0)

    reductions_arr = np.array(reductions)
    return (
        float(np.median(reductions_arr)),
        float(np.percentile(reductions_arr, 2.5)),
        float(np.percentile(reductions_arr, 97.5)),
    )


def interpret_result(p_value: float | None, effect: float | None, is_rate: bool) -> str:
    """Interpret statistical result using pre-registered tiers."""
    if p_value is None or effect is None:
        return "Inconclusive (insufficient data)"

    noise_floor = 0.06 if is_rate else 0  # 6% noise floor for rates

    if p_value < 0.05 and (abs(effect) > noise_floor if is_rate else True):
        direction = "favoring Ariadne" if effect > 0 else "favoring baseline"
        if not is_rate:
            direction = "favoring Ariadne" if effect < 0 else "favoring baseline"
        return f"Strong evidence ({direction})"
    elif p_value < 0.10:
        return "Suggestive (marginal significance)"
    elif effect is not None and is_rate and abs(effect) <= noise_floor:
        return "Inconclusive (within noise floor)"
    else:
        return "Inconclusive"


# ---------------------------------------------------------------------------
# Visualizations
# ---------------------------------------------------------------------------

def plot_resolve_rates(tasks: dict[str, dict], output_dir: Path) -> None:
    """Paired bar chart: resolve rate with Wilson score error bars."""
    if plt is None:
        return

    paired_tasks = [
        tid for tid, conds in tasks.items()
        if "ariadne" in conds and "baseline" in conds
    ]
    n = len(paired_tasks)
    if n == 0:
        return

    ar_pass = sum(1 for tid in paired_tasks if tasks[tid]["ariadne"]["passed"])
    bl_pass = sum(1 for tid in paired_tasks if tasks[tid]["baseline"]["passed"])

    ar_rate = ar_pass / n
    bl_rate = bl_pass / n
    ar_ci = wilson_ci(ar_pass, n)
    bl_ci = wilson_ci(bl_pass, n)

    fig, ax = plt.subplots(figsize=(6, 4))
    x = [0, 1]
    rates = [bl_rate * 100, ar_rate * 100]
    errors_low = [
        (bl_rate - bl_ci[0]) * 100,
        (ar_rate - ar_ci[0]) * 100,
    ]
    errors_high = [
        (bl_ci[1] - bl_rate) * 100,
        (ar_ci[1] - ar_rate) * 100,
    ]

    colors = ["#6C757D", "#198754"]
    bars = ax.bar(x, rates, color=colors, width=0.5)
    ax.errorbar(
        x, rates,
        yerr=[errors_low, errors_high],
        fmt="none", color="black", capsize=5,
    )

    ax.set_xticks(x)
    ax.set_xticklabels(["Baseline", "With Ariadne"])
    ax.set_ylabel("Resolve Rate (%)")
    ax.set_title(f"Resolve Rate Comparison (n={n} tasks)")
    ax.set_ylim(0, 100)

    for bar, rate in zip(bars, rates):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 2,
            f"{rate:.1f}%",
            ha="center", va="bottom", fontweight="bold",
        )

    plt.tight_layout()
    fig.savefig(output_dir / "resolve_rates.png", dpi=150)
    plt.close(fig)


def plot_token_usage(tasks: dict[str, dict], output_dir: Path) -> None:
    """Violin/box plot: per-task token usage by condition."""
    if plt is None:
        return

    ar_tokens = []
    bl_tokens = []
    for tid, conds in tasks.items():
        if "ariadne" in conds and "baseline" in conds:
            ar_val = conds["ariadne"].get("total_tokens")
            bl_val = conds["baseline"].get("total_tokens")
            if ar_val is not None and bl_val is not None:
                ar_tokens.append(ar_val / 1000)  # Display in K tokens
                bl_tokens.append(bl_val / 1000)

    if not ar_tokens:
        return

    fig, ax = plt.subplots(figsize=(6, 4))
    parts = ax.violinplot(
        [bl_tokens, ar_tokens],
        positions=[0, 1],
        showmeans=True,
        showmedians=True,
    )

    # Color the violins
    colors = ["#6C757D", "#198754"]
    for pc, color in zip(parts["bodies"], colors):
        pc.set_facecolor(color)
        pc.set_alpha(0.6)

    ax.set_xticks([0, 1])
    ax.set_xticklabels(["Baseline", "With Ariadne"])
    ax.set_ylabel("Total Tokens (K)")
    ax.set_title(f"Token Usage Distribution (n={len(ar_tokens)} tasks)")

    plt.tight_layout()
    fig.savefig(output_dir / "token_usage.png", dpi=150)
    plt.close(fig)


def plot_cost_comparison(tasks: dict[str, dict], output_dir: Path) -> None:
    """Box plot: per-task API cost by condition."""
    if plt is None:
        return

    ar_costs = []
    bl_costs = []
    for tid, conds in tasks.items():
        if "ariadne" in conds and "baseline" in conds:
            ar_val = conds["ariadne"].get("cost_usd")
            bl_val = conds["baseline"].get("cost_usd")
            if ar_val is not None and bl_val is not None:
                ar_costs.append(ar_val)
                bl_costs.append(bl_val)

    if not ar_costs:
        return

    fig, ax = plt.subplots(figsize=(6, 4))
    bp = ax.boxplot(
        [bl_costs, ar_costs],
        labels=["Baseline", "With Ariadne"],
        patch_artist=True,
    )

    colors = ["#6C757D", "#198754"]
    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)

    ax.set_ylabel("Cost (USD)")
    ax.set_title(f"Per-Task API Cost (n={len(ar_costs)} tasks)")

    plt.tight_layout()
    fig.savefig(output_dir / "cost_comparison.png", dpi=150)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def generate_report(
    data: dict,
    tasks: dict[str, dict],
    test_results: list[TestResult],
    bootstrap_results: dict[str, tuple[float, float, float]],
    output_path: Path,
) -> None:
    """Generate RESULTS.md summary report."""
    metadata = data.get("metadata", {})
    raw_results = data.get("results", [])

    # Count paired tasks
    paired_tasks = [
        tid for tid, conds in tasks.items()
        if "ariadne" in conds and "baseline" in conds
    ]
    n = len(paired_tasks)

    # Compute summary stats
    ar_pass = sum(1 for tid in paired_tasks if tasks[tid]["ariadne"]["passed"])
    bl_pass = sum(1 for tid in paired_tasks if tasks[tid]["baseline"]["passed"])

    lines = [
        "# Ariadne MCP Benchmark Results",
        "",
        "## Methodology",
        "",
        f"- **Model**: {metadata.get('model', 'unknown')}",
        f"- **Ariadne commit**: `{(metadata.get('ariadne_commit') or 'unknown')[:8]}`",
        f"- **Timestamp**: {metadata.get('timestamp', 'unknown')}",
        f"- **Paired tasks**: {n}",
        f"- **Total runs**: {len(raw_results)}",
        "",
        "## Primary Results",
        "",
        "### Resolve Rate",
        "",
        f"| Condition | Pass | Fail | Rate |",
        f"|-----------|------|------|------|",
        f"| Baseline | {bl_pass} | {n - bl_pass} | {bl_pass/n*100:.1f}% |" if n > 0 else "",
        f"| Ariadne | {ar_pass} | {n - ar_pass} | {ar_pass/n*100:.1f}% |" if n > 0 else "",
        "",
    ]

    # Add statistical test results
    for tr in test_results:
        lines.extend([
            f"### {tr.name}",
            "",
            f"- **n**: {tr.n}",
        ])
        if tr.p_value is not None:
            lines.append(f"- **p-value**: {tr.p_value:.4f}")
        if tr.effect_size is not None:
            lines.append(f"- **Effect size**: {tr.effect_size:.4f}")
        if tr.ci_low is not None and tr.ci_high is not None:
            lines.append(f"- **95% CI**: [{tr.ci_low:.4f}, {tr.ci_high:.4f}]")
        lines.extend([
            f"- **Interpretation**: {tr.interpretation}",
            "",
        ])

    # Bootstrap CIs
    if bootstrap_results:
        lines.extend([
            "### Bootstrap Relative Reductions",
            "",
            "| Metric | Median Reduction | 95% CI |",
            "|--------|-----------------|--------|",
        ])
        for metric, (median, ci_low, ci_high) in bootstrap_results.items():
            lines.append(
                f"| {metric} | {median:.1f}% | [{ci_low:.1f}%, {ci_high:.1f}%] |"
            )
        lines.append("")

    # Exploratory
    lines.extend([
        "## Exploratory",
        "",
        "See raw results JSON for per-task details, tool call traces, ",
        "and Ariadne tool usage patterns.",
        "",
        "## Threats to Validity",
        "",
        "- Infrastructure noise: API latency and model routing can cause 6pp swings",
        "- Small sample sizes may limit statistical power",
        "- Task selection may not be representative of real-world usage",
        "- Evaluation is automated (test suite pass/fail) — does not capture code quality",
    ])

    output_path.write_text("\n".join(lines))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze Ariadne MCP benchmark results")
    parser.add_argument("results", help="Path to results JSON file")
    parser.add_argument("--output", default="RESULTS.md", help="Output report path")
    parser.add_argument("--plots", default="results", help="Directory for plot images")
    parser.add_argument("--bootstrap-samples", type=int, default=10_000, help="Bootstrap iterations")

    args = parser.parse_args()

    results_path = Path(args.results)
    if not results_path.exists():
        print(f"Results file not found: {results_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading results from {results_path}...")
    data = load_results(results_path)
    raw_results = data.get("results", [])

    print(f"Loaded {len(raw_results)} raw results")

    # Aggregate
    tasks = aggregate_by_task(raw_results)
    paired_count = sum(
        1 for conds in tasks.values()
        if "ariadne" in conds and "baseline" in conds
    )
    print(f"Aggregated into {len(tasks)} tasks ({paired_count} paired)")

    # Run statistical tests
    print("Running statistical tests...")
    test_results = [
        mcnemar_test(tasks),
        wilcoxon_test(tasks, "total_tokens", "Wilcoxon signed-rank (total tokens)"),
        wilcoxon_test(tasks, "cost_usd", "Wilcoxon signed-rank (API cost)"),
        wilcoxon_test(tasks, "duration_ms", "Wilcoxon signed-rank (wall-clock time)"),
    ]

    for tr in test_results:
        p_str = f"p={tr.p_value:.4f}" if tr.p_value is not None else "N/A"
        print(f"  {tr.name}: {p_str} — {tr.interpretation}")

    # Bootstrap CIs
    print("Computing bootstrap confidence intervals...")
    bootstrap_results = {}
    for metric in ["total_tokens", "cost_usd", "duration_ms"]:
        median, ci_low, ci_high = bootstrap_ci(tasks, metric, args.bootstrap_samples)
        bootstrap_results[metric] = (median, ci_low, ci_high)
        print(f"  {metric}: {median:.1f}% reduction [{ci_low:.1f}%, {ci_high:.1f}%]")

    # Generate plots
    plots_dir = Path(args.plots)
    plots_dir.mkdir(parents=True, exist_ok=True)

    if plt is not None:
        print("Generating plots...")
        plot_resolve_rates(tasks, plots_dir)
        plot_token_usage(tasks, plots_dir)
        plot_cost_comparison(tasks, plots_dir)
        print(f"Plots saved to {plots_dir}/")
    else:
        print("Skipping plots (matplotlib not installed)")

    # Generate report
    output_path = Path(args.output)
    generate_report(data, tasks, test_results, bootstrap_results, output_path)
    print(f"Report saved to {output_path}")


if __name__ == "__main__":
    main()
