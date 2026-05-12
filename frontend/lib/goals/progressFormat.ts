/**
 * Presentation helpers only — business rules for status live on the server (`app/services/goals/progress.py`).
 */
import type { Goal, GoalUnit } from "@/lib/goals/types";

export function goalProgressRatio(goal: Goal): number {
  if (goal.targetValue <= 0) return 0;
  return Math.min(1, goal.currentValue / goal.targetValue);
}

export function formatGoalValue(value: number, unit: GoalUnit): string {
  if (unit === "eur") return `€${value.toFixed(0)}`;
  if (unit === "percent") return `${value.toFixed(0)}%`;
  if (unit === "minutes") return `${value.toFixed(0)} min`;
  return `${value.toFixed(0)} tasks`;
}

export function formatGoalUnitLabel(unit: GoalUnit): string {
  if (unit === "eur") return "€";
  if (unit === "percent") return "%";
  if (unit === "minutes") return "minutes";
  return "tasks";
}
