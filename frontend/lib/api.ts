export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type EventType = "work_started" | "task_completed" | "expense_added" | "cleaning_done";

export type EventItem = {
  id: string;
  type: EventType;
  source: "web" | "iot" | "system";
  payload: Record<string, unknown>;
  created_at: string;
};
