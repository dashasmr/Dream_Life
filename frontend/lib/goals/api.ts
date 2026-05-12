import { API_URL } from "@/lib/api";
import type { Goal, GoalCreatePayload, GoalPeriod } from "@/lib/goals/types";

export async function fetchGoalsForPeriod(
  period: GoalPeriod,
  fromIso: string,
  toIso: string,
  baseUrl: string = API_URL
): Promise<Goal[]> {
  const qs = `from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&period=${period}`;
  const response = await fetch(`${baseUrl}/goals?${qs}`, { cache: "no-store" });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail ||
        `Failed to load goals (HTTP ${response.status}). If the API was just updated, run: alembic upgrade head`
    );
  }
  return response.json() as Promise<Goal[]>;
}

export async function createGoal(
  payload: GoalCreatePayload,
  fromIso: string,
  toIso: string,
  baseUrl: string = API_URL
): Promise<Goal> {
  const qs = `from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;
  const response = await fetch(`${baseUrl}/goals?${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Failed to create goal");
  }
  return response.json() as Promise<Goal>;
}

export async function deleteGoal(goalId: string, baseUrl: string = API_URL): Promise<void> {
  const response = await fetch(`${baseUrl}/goals/${goalId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete goal");
}
