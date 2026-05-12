import type { AutomationSettingCategory } from "@/services/automation/settingsTypes";

/** Static metadata for Settings UI + default toggles. IDs must match `AUTOMATION_RULES` in `rules.ts`. */
export type AutomationRuleSettingMeta = {
  id: string;
  name: string;
  description: string;
  category: AutomationSettingCategory;
  /** Used when the user has no saved preference yet. */
  defaultEnabled: boolean;
};

export const AUTOMATION_RULE_SETTING_CATALOG: readonly AutomationRuleSettingMeta[] = [
  {
    id: "auto-overdue-cleaning-notification",
    name: "Overdue Cleaning Reminder",
    description: "Notify when a cleaning zone is overdue so you can reset the space.",
    category: "cleaning",
    defaultEnabled: true
  },
  {
    id: "auto-no-focus-recommendation",
    name: "No Focus Today Recommendation",
    description: "Suggest starting a focus session when none are logged for today.",
    category: "focus",
    defaultEnabled: true
  },
  {
    id: "auto-goal-at-risk-signal",
    name: "Goal At Risk Warning",
    description: "Surface a signal when a weekly or monthly goal is behind.",
    category: "goals",
    defaultEnabled: true
  },
  {
    id: "auto-strong-productivity-insight",
    name: "Strong Productivity Insight",
    description: "Celebrate strong days when tasks, focus, and home health all look good.",
    category: "insights",
    defaultEnabled: false
  },
  {
    id: "auto-high-priority-task-notification",
    name: "High Priority Task Reminder",
    description: "Notify when an important task is still open.",
    category: "focus",
    defaultEnabled: true
  },
  {
    id: "auto-high-spend-notification",
    name: "High Spending Alert",
    description: "Warn when today’s expenses cross the configured threshold.",
    category: "insights",
    defaultEnabled: true
  },
  {
    id: "auto-high-priority-task-recommendation",
    name: "High Priority Task Next Step",
    description: "Recommend tackling your top priority task next.",
    category: "focus",
    defaultEnabled: true
  },
  {
    id: "auto-finance-review-recommendation",
    name: "Spending Review Suggestion",
    description: "Suggest reviewing finance after high daily spend.",
    category: "insights",
    defaultEnabled: true
  },
  {
    id: "auto-quiet-log-recommendation",
    name: "Quiet Day Log Nudge",
    description: "After 10:00, gently prompt to log an action if the day is still empty.",
    category: "focus",
    defaultEnabled: true
  }
];

const CATALOG_IDS = new Set(AUTOMATION_RULE_SETTING_CATALOG.map((r) => r.id));

/** Rules shipped in code but missing from the catalog stay enabled (safe if catalog is empty). */
export function isKnownAutomationRuleId(ruleId: string): boolean {
  return CATALOG_IDS.has(ruleId);
}
