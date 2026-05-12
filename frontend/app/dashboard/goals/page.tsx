"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { describeFetchFailure } from "@/lib/api";
import {
  createGoal,
  deleteGoal,
  fetchGoalsForPeriod,
  formatGoalValue,
  goalProgressRatio,
  type Goal,
  type GoalCategory,
  type GoalPeriod,
  type GoalUnit
} from "@/lib/goals";
import { getLocalMonthRangeIso, getLocalWeekRangeIso } from "@/lib/datetime";
import { ui } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function defaultUnitForCategory(cat: GoalCategory): GoalUnit {
  if (cat === "finance") return "eur";
  if (cat === "home") return "percent";
  return "tasks";
}

function statusLabel(s: Goal["status"]): string {
  if (s === "completed") return "Completed";
  if (s === "at_risk") return "At risk";
  return "On track";
}

function statusClass(s: Goal["status"]): string {
  if (s === "completed") return "text-[#7dccb0]";
  if (s === "at_risk") return "text-[#f7b0a2]";
  return "text-[#e8c48a]";
}

/** Native selects avoid z-index / portal clashes with the fixed header (Base UI dropdown was same layer as NavBar). */
const goalSelectClass =
  "h-10 w-full min-w-0 rounded-xl border border-[#2A2F36] bg-[#11151A] px-3 text-sm text-white outline-none focus:border-[#C6A36B]/50 disabled:cursor-not-allowed disabled:opacity-60";

export default function DashboardGoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const monthRange = useMemo(() => getLocalMonthRangeIso(new Date()), []);
  const weekRange = useMemo(() => getLocalWeekRangeIso(new Date()), []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [monthly, weekly] = await Promise.all([
        fetchGoalsForPeriod("monthly", monthRange.from, monthRange.to),
        fetchGoalsForPeriod("weekly", weekRange.from, weekRange.to)
      ]);
      setGoals([...monthly, ...weekly]);
    } catch (e: unknown) {
      setError(describeFetchFailure(e));
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [monthRange.from, monthRange.to, weekRange.from, weekRange.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("productivity");
  const [targetValue, setTargetValue] = useState("20");
  const [unit, setUnit] = useState<GoalUnit>("tasks");
  const [period, setPeriod] = useState<GoalPeriod>("monthly");

  useEffect(() => {
    setUnit(defaultUnitForCategory(category));
  }, [category]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const target = parseFloat(targetValue);
    if (!title.trim() || Number.isNaN(target) || target <= 0) return;
    const range = period === "monthly" ? monthRange : weekRange;
    setSaving(true);
    setError(null);
    try {
      await createGoal(
        { title: title.trim(), category, targetValue: target, unit, period },
        range.from,
        range.to
      );
      setTitle("");
      setTargetValue("20");
      await load();
    } catch (err: unknown) {
      setError(describeFetchFailure(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteGoal(id);
      await load();
    } catch (err: unknown) {
      setError(describeFetchFailure(err));
    }
  }

  const monthlyGoals = goals.filter((g) => g.period === "monthly");
  const weeklyGoals = goals.filter((g) => g.period === "weekly");

  return (
    <div className={ui.contentClass}>
      <section className={ui.panelClass}>
        <h1 className="text-2xl font-semibold text-white">Goals</h1>
        <p className={ui.pageHint}>
          Targets tied to real data: tasks, focus minutes, savings (balance delta), or average home health in the
          window you choose.
        </p>

        {error && <p className="mt-4 text-sm text-[#f7b0a2]">{error}</p>}

        <form onSubmit={onCreate} className="mt-6 rounded-2xl border border-[#2A2F36] bg-[#0F1318] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#C6A36B]">New goal</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2 md:col-span-2">
              <label className={`text-sm ${ui.mutedText}`}>Title</label>
              <input
                className="h-10 rounded-xl border border-[#2A2F36] bg-[#11151A] px-3 text-sm text-white outline-none focus:border-[#C6A36B]/50"
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                placeholder="e.g. Complete 20 tasks this month"
                required
              />
            </div>
            <div className="grid gap-2">
              <label className={`text-sm ${ui.mutedText}`} htmlFor="goal-category">
                Category
              </label>
              <select
                id="goal-category"
                className={goalSelectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as GoalCategory)}
              >
                <option value="productivity">Productivity</option>
                <option value="finance">Finance</option>
                <option value="home">Home</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className={`text-sm ${ui.mutedText}`}>Target</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                className="h-10 rounded-xl border border-[#2A2F36] bg-[#11151A] px-3 text-sm tabular-nums text-white outline-none focus:border-[#C6A36B]/50"
                value={targetValue}
                onChange={(ev) => setTargetValue(ev.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label className={`text-sm ${ui.mutedText}`} htmlFor="goal-unit">
                Unit
              </label>
              <select
                id="goal-unit"
                className={goalSelectClass}
                value={unit}
                disabled={category === "finance" || category === "home"}
                onChange={(e) => setUnit(e.target.value as GoalUnit)}
              >
                {category === "productivity" ? (
                  <>
                    <option value="tasks">Tasks</option>
                    <option value="minutes">Focus minutes</option>
                  </>
                ) : null}
                {category === "finance" ? <option value="eur">€ saved (balance delta)</option> : null}
                {category === "home" ? <option value="percent">Home health % (avg)</option> : null}
              </select>
            </div>
            <div className="grid gap-2">
              <label className={`text-sm ${ui.mutedText}`} htmlFor="goal-period">
                Period
              </label>
              <select
                id="goal-period"
                className={goalSelectClass}
                value={period}
                onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="mt-4 min-h-10 rounded-xl border border-[#C6A36B] bg-[#C6A36B]/15 text-[#C6A36B] hover:bg-[#C6A36B]/25"
          >
            {saving ? "Saving…" : "Create goal"}
          </Button>
        </form>

        {loading && <p className={`mt-8 text-sm ${ui.mutedText}`}>Loading goals…</p>}

        {!loading && (
          <div className="mt-8 space-y-8">
            <GoalsSection
              label="Monthly goals"
              hint={`Window: local calendar month (same as finance summaries).`}
              items={monthlyGoals}
              onDelete={onDelete}
            />
            <GoalsSection
              label="Weekly goals"
              hint={`Window: local Mon–Sun week.`}
              items={weeklyGoals}
              onDelete={onDelete}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function GoalsSection({
  label,
  hint,
  items,
  onDelete
}: {
  label: string;
  hint: string;
  items: Goal[];
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{label}</h2>
      <p className={`mt-1 text-sm ${ui.mutedText}`}>{hint}</p>
      {items.length === 0 ? (
        <p className={`mt-4 text-sm ${ui.mutedText}`}>No goals yet — add one above.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {items.map((g) => {
            const ratio = goalProgressRatio(g);
            const pct = Math.round(ratio * 100);
            return (
              <li key={g.id}>
                <Card className={`${ui.card} border-[#2A2F36] bg-[#0F1318] p-5`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8F98]">{g.category}</p>
                      <p className="mt-1 text-lg font-medium text-white">{g.title}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 text-xs text-[#8A8F98] hover:text-[#f7b0a2]"
                      onClick={() => void onDelete(g.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="mt-3 text-sm tabular-nums text-[#E5E5E5]">
                    {formatGoalValue(g.currentValue, g.unit)} / {formatGoalValue(g.targetValue, g.unit)}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1a1f26]">
                    <div
                      className="h-full rounded-full bg-[#C6A36B] transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`mt-2 text-sm ${ui.mutedText}`}>{pct}%</p>
                  <p className={`mt-3 text-sm font-medium ${statusClass(g.status)}`}>Status: {statusLabel(g.status)}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
