import { API_URL } from "@/lib/api";
import type { BehaviorPattern } from "@/lib/patterns/types";

/**
 * Half-open window [fromIso, toIso), same contract as finance summary range.
 */
export async function fetchBehaviorPatterns(
  fromIso: string,
  toIso: string,
  baseUrl: string = API_URL
): Promise<BehaviorPattern[]> {
  const qs = `from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;
  const response = await fetch(`${baseUrl}/analytics/behavior-patterns?${qs}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load behavior patterns");
  return response.json() as Promise<BehaviorPattern[]>;
}
