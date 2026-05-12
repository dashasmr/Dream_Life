import { pickTopPriorityTask } from "@/lib/commandCenter";
import { computeHomeHealthScore } from "@/lib/cleaningHealth";
import type { GoalCategory } from "@/lib/goals/types";
import { hasFocusTouchToday } from "@/lib/systemStatus";
import type { AutomationContext, AutomationRule, AutomationSink } from "@/services/automation/types";
import type { NotificationDraft } from "@/services/notifications";
import type { RiskCategory } from "@/lib/risks/types";
import { HIGH_SPENDING_EUR_THRESHOLD } from "@/services/insights";

function localDayStartIso(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function riskCategoryForGoal(category: GoalCategory): RiskCategory {
  if (category === "finance") return "finance";
  if (category === "home") return "environment";
  return "focus";
}

const STRONG_DAY_MIN_TASKS = 5;
const STRONG_DAY_MIN_FOCUS_MINUTES = 45;
const STRONG_DAY_MIN_HOME_SCORE = 80;

/** 1. Overdue cleaning → notification */
const ruleOverdueCleaningNotification: AutomationRule = {
  id: "auto-overdue-cleaning-notification",
  name: "Overdue cleaning → notification",
  enabled: true,
  condition: (ctx) => ctx.cleaningZones.some((z) => z.status === "overdue"),
  action: (ctx, sink) => {
    const now = ctx.now;
    const created_at = localDayStartIso(now);
    const overdueZones = ctx.cleaningZones.filter((z) => z.status === "overdue");
    const deskOverdue = overdueZones.find((z) => z.name.toLowerCase().includes("desk"));
    let draft: NotificationDraft;
    if (deskOverdue) {
      draft = {
        id: "notif-cleaning-desk-overdue",
        type: "warning",
        category: "cleaning",
        title: "Desk cleaning overdue",
        message: `“${deskOverdue.name.trim() || "Desk"}” is past due — a quick reset helps focus.`,
        created_at,
        action: {
          label: "Mark as cleaned",
          type: "mutation",
          target: "cleaning_mark_done",
          payload: { zoneId: deskOverdue.id }
        }
      };
    } else {
      const z = overdueZones[0];
      draft = {
        id: "notif-cleaning-zone-overdue",
        type: "warning",
        category: "cleaning",
        title: "Cleaning overdue",
        message: `“${z.name.trim() || "A zone"}” needs attention.`,
        created_at,
        action: {
          label: "Mark as cleaned",
          type: "mutation",
          target: "cleaning_mark_done",
          payload: { zoneId: z.id }
        }
      };
    }
    sink.notifications.push(draft);
  }
};

/** 2. No focus today → recommendation */
const ruleNoFocusRecommendation: AutomationRule = {
  id: "auto-no-focus-recommendation",
  name: "No focus today → recommendation",
  enabled: true,
  condition: (ctx) => !hasFocusTouchToday(ctx.focusSessions, ctx.now),
  action: (ctx, sink) => {
    sink.recommendations.push({
      id: "action-focus-start",
      type: "productivity",
      priority: "high",
      message: "Start a focus session.",
      generatedAt: ctx.now.toISOString(),
      icon: "🔥",
      primaryAction: { kind: "focus_start", buttonLabel: "Start focus" }
    });
  }
};

/** 3. Goal at risk → automation risk signal */
const ruleGoalAtRisk: AutomationRule = {
  id: "auto-goal-at-risk-signal",
  name: "Goal at risk → risk signal",
  enabled: true,
  condition: (ctx) => (ctx.goals ?? []).some((g) => g.status === "at_risk"),
  action: (ctx, sink) => {
    const detectedAt = ctx.now.toISOString();
    for (const g of ctx.goals ?? []) {
      if (g.status !== "at_risk") continue;
      sink.automationRiskSignals.push({
        id: `auto-goal-risk-${g.id}`,
        severity: "medium",
        category: riskCategoryForGoal(g.category),
        message: `Goal “${g.title.trim() || "Untitled"}” is at risk for this ${g.period} window — adjust pace or scope.`,
        detectedAt,
        source: "automation"
      });
    }
  }
};

/** 4. Strong productivity day → positive insight */
const ruleStrongProductivityInsight: AutomationRule = {
  id: "auto-strong-productivity-insight",
  name: "Strong productivity day → positive insight",
  enabled: true,
  condition: (ctx) => {
    const tasks = ctx.todayTasksCompleted;
    const focus = ctx.todayFocusMinutes;
    if (tasks === undefined || focus === undefined) return false;
    const home = computeHomeHealthScore(ctx.cleaningZones);
    const homeOk = home !== null && home.scorePercent >= STRONG_DAY_MIN_HOME_SCORE;
    return (
      tasks >= STRONG_DAY_MIN_TASKS &&
      focus >= STRONG_DAY_MIN_FOCUS_MINUTES &&
      homeOk
    );
  },
  action: (ctx, sink) => {
    sink.positiveInsights.push(
      "Strong day: you moved many tasks forward, logged solid focus time, and home care still looks healthy — keep this rhythm."
    );
  }
};

/** High-priority open task → notification */
const ruleHighPriorityTaskNotification: AutomationRule = {
  id: "auto-high-priority-task-notification",
  name: "High priority task → notification",
  enabled: true,
  condition: (ctx) => pickTopPriorityTask(ctx.tasks, ctx.now) !== null,
  action: (ctx, sink) => {
    const highTask = pickTopPriorityTask(ctx.tasks, ctx.now)!;
    sink.notifications.push({
      id: "notif-tasks-high-priority",
      type: "warning",
      category: "tasks",
      title: "High priority task still open",
      message: `“${highTask.title.trim() || "Task"}” is incomplete — consider doing it first.`,
      created_at: localDayStartIso(ctx.now),
      action: {
        label: "Open task",
        type: "navigate",
        target: `/work/tasks?highlight=${encodeURIComponent(highTask.id)}`
      }
    });
  }
};

/** High spending today → notification */
const ruleHighSpendNotification: AutomationRule = {
  id: "auto-high-spend-notification",
  name: "High spending → notification",
  enabled: true,
  condition: (ctx) => ctx.expensesTodayTotal > HIGH_SPENDING_EUR_THRESHOLD,
  action: (ctx, sink) => {
    sink.notifications.push({
      id: "notif-finance-high-spend",
      type: "warning",
      category: "finance",
      title: "High spending detected today",
      message: `Today's expenses are above €${HIGH_SPENDING_EUR_THRESHOLD}. Review transactions when you can.`,
      created_at: localDayStartIso(ctx.now),
      action: {
        label: "Open finance",
        type: "navigate",
        target: "/finance/dashboard"
      }
    });
  }
};

/** High-priority task → recommendation */
const ruleHighPriorityTaskRecommendation: AutomationRule = {
  id: "auto-high-priority-task-recommendation",
  name: "High priority task → recommendation",
  enabled: true,
  condition: (ctx) => pickTopPriorityTask(ctx.tasks, ctx.now) !== null,
  action: (ctx, sink) => {
    const topHigh = pickTopPriorityTask(ctx.tasks, ctx.now)!;
    sink.recommendations.push({
      id: "action-high-priority-task",
      type: "tasks",
      priority: "high",
      message: "Complete your high priority task.",
      generatedAt: ctx.now.toISOString(),
      icon: "🎯",
      primaryAction: { kind: "task_open", taskId: topHigh.id, buttonLabel: "Open task" }
    });
  }
};

/** High spending → finance recommendation */
const ruleFinanceReviewRecommendation: AutomationRule = {
  id: "auto-finance-review-recommendation",
  name: "High spending → finance recommendation",
  enabled: true,
  condition: (ctx) => ctx.expensesTodayTotal > HIGH_SPENDING_EUR_THRESHOLD,
  action: (ctx, sink) => {
    sink.recommendations.push({
      id: "action-finance-review",
      type: "finance",
      priority: "medium",
      message: "Review today's spending.",
      generatedAt: ctx.now.toISOString(),
      icon: "💰",
      primaryAction: { kind: "navigate", href: "/finance/dashboard", buttonLabel: "Open finance" }
    });
  }
};

/** Quiet event log (after 10:00) → gentle logging recommendation */
const ruleQuietLogRecommendation: AutomationRule = {
  id: "auto-quiet-log-recommendation",
  name: "Quiet log → recommendation",
  enabled: true,
  condition: (ctx) => ctx.dailyEventsTotal === 0 && ctx.now.getHours() >= 10,
  action: (ctx, sink) => {
    sink.recommendations.push({
      id: "action-log-activity",
      type: "productivity",
      priority: "low",
      message: "Your day log is quiet — capture one meaningful action (task, expense, or focus).",
      generatedAt: ctx.now.toISOString(),
      icon: "📝",
      primaryAction: { kind: "navigate", href: "/work/tasks", buttonLabel: "Open tasks" }
    });
  }
};

/**
 * Order matters only for human readability; each rule guards its own condition.
 * Required assignment rules: 1–4 at the top; the rest preserve prior dashboard behaviour via the engine.
 */
export const AUTOMATION_RULES: AutomationRule[] = [
  ruleOverdueCleaningNotification,
  ruleNoFocusRecommendation,
  ruleGoalAtRisk,
  ruleStrongProductivityInsight,
  ruleHighPriorityTaskNotification,
  ruleHighSpendNotification,
  ruleHighPriorityTaskRecommendation,
  ruleFinanceReviewRecommendation,
  ruleQuietLogRecommendation
];
