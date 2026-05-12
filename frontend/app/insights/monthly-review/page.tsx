"use client";

import { useEffect, useMemo, useState } from "react";
import {
  API_URL,
  CleaningZone,
  DailySnapshot,
  describeFetchFailure,
  EventItem,
  FinanceRangeSummary,
  FinanceTransaction,
  MonthlyReview
} from "@/lib/api";
import {
  computeEventCountsByType,
  computeMonthlyStats,
  mostProductiveLocalDay,
  normalizeAnalyticsEvents
} from "@/lib/analytics";
import { computeHomeHealthScore, mostOverdueZone } from "@/lib/cleaningHealth";
import { formatDateFiNumeric, getLocalMonthRangeIso, localCalendarDayKeyFromDate } from "@/lib/datetime";
import type { BehaviorPattern } from "@/lib/patterns";
import { topExpenseCategoryInRange } from "@/lib/weeklyReviewInsights";
import { ui } from "@/lib/ui";

function formatEur(value: number): string {
  return `€${value.toFixed(2)}`;
}

function formatDayKeyLabel(dayKey: string): string {
  const parts = dayKey.split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dayKey;
  const [yy, mm, dd] = parts;
  return formatDateFiNumeric(new Date(yy, mm - 1, dd));
}

function averageHomeHealthInLocalMonth(snapshots: DailySnapshot[], ref: Date): number | null {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const startKey = localCalendarDayKeyFromDate(new Date(y, m, 1));
  const endKey = localCalendarDayKeyFromDate(new Date(y, m + 1, 0));
  const vals = snapshots
    .filter((s) => s.date >= startKey && s.date <= endKey && s.home_health_score != null)
    .map((s) => s.home_health_score as number);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function MonthlyReviewPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [zones, setZones] = useState<CleaningZone[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceRangeSummary | null>(null);
  const [expenseRows, setExpenseRows] = useState<FinanceTransaction[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [behaviorPatterns, setBehaviorPatterns] = useState<BehaviorPattern[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [monthlyAi, setMonthlyAi] = useState<MonthlyReview | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const anchor = useMemo(() => new Date(), []);
  const { from, to, monthFromMs, monthToMs, monthTitle } = useMemo(() => {
    const range = getLocalMonthRangeIso(anchor);
    const a = new Date(range.from).getTime();
    const b = new Date(range.to).getTime();
    const title = new Date(range.from).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return { from: range.from, to: range.to, monthFromMs: a, monthToMs: b, monthTitle: title };
  }, [anchor]);

  useEffect(() => {
    const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API_URL}/events?limit=500`, { cache: "no-store" }),
      fetch(`${API_URL}/cleaning/zones`, { cache: "no-store" }),
      fetch(`${API_URL}/finance/summary/range?${qs}`, { cache: "no-store" }),
      fetch(`${API_URL}/finance/transactions?kind=expense&limit=500`, { cache: "no-store" }),
      fetch(`${API_URL}/analytics/daily-snapshots?limit=62`, { cache: "no-store" }),
      fetch(`${API_URL}/analytics/behavior-patterns?${qs}`, { cache: "no-store" })
    ])
      .then(async ([evRes, zRes, finRes, txRes, snapRes, patRes]) => {
        if (!evRes.ok) throw new Error("Failed to load events");
        if (!zRes.ok) throw new Error("Failed to load cleaning zones");
        if (!finRes.ok) throw new Error("Failed to load finance summary");
        if (!txRes.ok) throw new Error("Failed to load transactions");
        if (!snapRes.ok) throw new Error("Failed to load daily snapshots");

        const rawEv = (await evRes.json()) as Array<Omit<EventItem, "type"> & { type: string }>;
        setEvents(normalizeAnalyticsEvents(rawEv));
        setZones(await zRes.json());
        setFinanceSummary(await finRes.json());
        setExpenseRows(await txRes.json());
        setSnapshots(await snapRes.json());
        if (patRes.ok) {
          setBehaviorPatterns((await patRes.json()) as BehaviorPattern[]);
        } else {
          setBehaviorPatterns([]);
        }
      })
      .catch((err: unknown) => setError(describeFetchFailure(err)))
      .finally(() => setLoading(false));
  }, [from, to]);

  const monthlyStats = useMemo(
    () => computeMonthlyStats(events, monthFromMs, monthToMs),
    [events, monthFromMs, monthToMs]
  );

  const monthEventCounts = useMemo(
    () => computeEventCountsByType(events, monthFromMs, monthToMs),
    [events, monthFromMs, monthToMs]
  );

  const bestDay = useMemo(
    () => mostProductiveLocalDay(events, monthFromMs, monthToMs),
    [events, monthFromMs, monthToMs]
  );

  const financeBlock = useMemo(() => {
    const top = topExpenseCategoryInRange(expenseRows, monthFromMs, monthToMs);
    return {
      income: financeSummary?.income_total ?? 0,
      expense: financeSummary?.expense_total ?? 0,
      balance: financeSummary?.balance_delta ?? 0,
      topCategory: top?.category ?? null,
      topAmount: top?.total ?? 0
    };
  }, [expenseRows, financeSummary, monthFromMs, monthToMs]);

  const avgHomeHealth = useMemo(() => averageHomeHealthInLocalMonth(snapshots, anchor), [snapshots, anchor]);
  const currentHomeHealth = useMemo(() => computeHomeHealthScore(zones), [zones]);
  const worstZone = useMemo(() => mostOverdueZone(zones), [zones]);

  async function generateMonthlyAi() {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch(`${API_URL}/ai/monthly-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthFrom: from, monthTo: to })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to generate monthly review");
      }
      const data = (await response.json()) as MonthlyReview;
      setMonthlyAi(data);
    } catch (e: unknown) {
      setAiError(describeFetchFailure(e));
      setMonthlyAi(null);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className={ui.contentClass}>
      <section className={ui.panelClass}>
        <h1 className="text-2xl font-semibold text-white">Monthly review</h1>
        <p className={ui.pageHint}>How did this month go? Range uses your local calendar month.</p>
        <p className={`mt-1 text-sm ${ui.mutedText}`}>{monthTitle}</p>

        {loading && <p className={`mt-6 text-sm ${ui.mutedText}`}>Loading your month…</p>}
        {error && <p className="mt-6 text-[#f7b0a2]">{error}</p>}

        {!loading && !error && (
          <div className="mt-8 space-y-8">
            <section className="rounded-2xl border border-[#2A2F36] bg-[#0F1318] p-6">
              <h2 className="text-lg font-semibold text-white">Productivity</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Tasks completed</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{monthlyStats.tasksCompleted}</dd>
                </div>
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Focus minutes</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{monthlyStats.focusMinutes}</dd>
                </div>
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Most productive day</dt>
                  <dd className="mt-1 text-lg font-semibold text-white">
                    {bestDay ? formatDayKeyLabel(bestDay.dayKey) : "—"}
                  </dd>
                  {bestDay && (
                    <p className={`mt-1 text-sm ${ui.mutedText}`}>
                      {bestDay.tasksCompleted} tasks · {bestDay.focusMinutes} focus min
                    </p>
                  )}
                  {!bestDay && (
                    <p className={`mt-1 text-sm ${ui.mutedText}`}>No task or focus signals in this window yet.</p>
                  )}
                </div>
              </dl>
              <p className={`mt-3 text-xs ${ui.mutedText}`}>
                Pomodoros completed: {monthEventCounts.pomodoro_completed ?? 0}
              </p>
            </section>

            <section className="rounded-2xl border border-[#2A2F36] bg-[#0F1318] p-6">
              <h2 className="text-lg font-semibold text-white">Finance</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Income</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{formatEur(financeBlock.income)}</dd>
                </div>
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Expenses</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{formatEur(financeBlock.expense)}</dd>
                </div>
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Balance</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{formatEur(financeBlock.balance)}</dd>
                </div>
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Top spending category</dt>
                  <dd className="mt-1 text-lg font-semibold text-white">{financeBlock.topCategory ?? "—"}</dd>
                  {financeBlock.topCategory != null && financeBlock.topAmount > 0 && (
                    <p className={`mt-1 text-sm tabular-nums ${ui.mutedText}`}>{formatEur(financeBlock.topAmount)}</p>
                  )}
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-[#2A2F36] bg-[#0F1318] p-6">
              <h2 className="text-lg font-semibold text-white">Behavior patterns</h2>
              <p className={`mt-1 text-sm ${ui.mutedText}`}>
                Deterministic analytics from the API (same signals as AI context). Not generated by the model.
              </p>
              {behaviorPatterns.length === 0 ? (
                <p className={`mt-4 text-sm ${ui.mutedText}`}>
                  No pattern cleared the bar for this window — keep logging focus, snapshots, and categorized expenses.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {behaviorPatterns.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border border-l-4 border-[#2A2F36] border-l-[#6B8FC6] bg-[#141A22] px-4 py-3 text-sm text-[#E5E5E5]"
                    >
                      <span className="text-xs uppercase tracking-wide text-[#9aa3ad]">
                        {p.category} · {(p.confidence * 100).toFixed(0)}%
                      </span>
                      <p className="mt-1 leading-relaxed">{p.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[#2A2F36] bg-[#0F1318] p-6">
              <h2 className="text-lg font-semibold text-white">Home</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Cleaning actions</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{monthlyStats.cleaningActions}</dd>
                </div>
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Average home health score</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {avgHomeHealth != null ? `${avgHomeHealth}%` : "—"}
                  </dd>
                  <p className={`mt-2 text-sm ${ui.mutedText}`}>
                    {avgHomeHealth != null
                      ? "Mean of daily snapshot scores in this month (when snapshots exist)."
                      : currentHomeHealth != null
                        ? `No snapshot samples this month; current score: ${currentHomeHealth.scorePercent}%.`
                        : "Add cleaning zones and generate daily snapshots to see a monthly average."}
                  </p>
                </div>
                <div>
                  <dt className={`text-sm ${ui.mutedText}`}>Most overdue zone</dt>
                  <dd className="mt-1 text-lg font-semibold text-white">{worstZone?.name ?? "—"}</dd>
                  {!worstZone && zones.length > 0 && (
                    <p className={`mt-2 text-sm ${ui.mutedText}`}>No overdue zones right now.</p>
                  )}
                  {zones.length === 0 && (
                    <p className={`mt-2 text-sm ${ui.mutedText}`}>No zones configured.</p>
                  )}
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-[#2A2F36] bg-[#0F1318] p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">AI month summary</h2>
                  <p className={`mt-1 text-sm ${ui.mutedText}`}>
                    Generated on demand from the same month window; does not auto-load.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void generateMonthlyAi()}
                  disabled={aiLoading}
                  className="shrink-0 rounded-xl border border-[#C6A36B] bg-[#C6A36B]/10 px-4 py-2 text-sm font-medium text-[#C6A36B] transition hover:bg-[#C6A36B]/20 disabled:opacity-50"
                >
                  {aiLoading ? "Working…" : "Generate AI summary"}
                </button>
              </div>

              {aiError && <p className="mt-4 text-sm text-[#f7b0a2]">{aiError}</p>}

              {!monthlyAi && !aiLoading && !aiError && (
                <p className={`mt-4 text-sm ${ui.mutedText}`}>Run the generator when you want wins, risks, and focus ideas.</p>
              )}

              {monthlyAi && (
                <div className="mt-6 space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-medium text-[#c9d0d8]">{monthlyAi.title}</p>
                    {monthlyAi.fallback && (
                      <span className="rounded-md border border-[#2A2F36] bg-[#141A22] px-2 py-0.5 text-xs text-[#9aa3ad]">
                        Rule-based fallback
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-[#E5E5E5]">{monthlyAi.summary}</p>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C6A36B]">Wins</h3>
                      <ul className="mt-2 space-y-2">
                        {(monthlyAi.wins.length ? monthlyAi.wins : ["—"]).map((line) => (
                          <li key={line} className="text-sm text-[#E5E5E5]">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C6A36B]">Risks</h3>
                      <ul className="mt-2 space-y-2">
                        {(monthlyAi.risks.length ? monthlyAi.risks : ["—"]).map((line) => (
                          <li key={line} className="text-sm text-[#E5E5E5]">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C6A36B]">Patterns</h3>
                      <ul className="mt-2 space-y-2">
                        {(monthlyAi.patterns.length ? monthlyAi.patterns : ["—"]).map((line) => (
                          <li key={line} className="text-sm text-[#E5E5E5]">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C6A36B]">Next month focus</h3>
                      <ul className="mt-2 space-y-2">
                        {(monthlyAi.nextMonthFocus.length ? monthlyAi.nextMonthFocus : ["—"]).map((line) => (
                          <li key={line} className="text-sm text-[#E5E5E5]">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
