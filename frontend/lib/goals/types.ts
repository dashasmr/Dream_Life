export type GoalCategory = "productivity" | "finance" | "home";
export type GoalUnit = "tasks" | "eur" | "percent" | "minutes";
export type GoalPeriod = "weekly" | "monthly";
export type GoalStatus = "on_track" | "at_risk" | "completed";

/** Matches GET /goals response (progress computed server-side for the requested window). */
export type Goal = {
  id: string;
  title: string;
  category: GoalCategory;
  targetValue: number;
  currentValue: number;
  unit: GoalUnit;
  period: GoalPeriod;
  status: GoalStatus;
};

export type GoalCreatePayload = {
  title: string;
  category: GoalCategory;
  targetValue: number;
  unit: GoalUnit;
  period: GoalPeriod;
};
