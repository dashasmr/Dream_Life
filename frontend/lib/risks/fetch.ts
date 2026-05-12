import { API_URL } from "@/lib/api";
import type { RiskSignal } from "@/lib/risks/types";

export async function fetchRiskSignals(
  fromIso: string,
  toIso: string,
  baseUrl: string = API_URL
): Promise<RiskSignal[]> {
  const qs = `from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;
  const response = await fetch(`${baseUrl}/analytics/risk-signals?${qs}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load risk signals");
  return response.json() as Promise<RiskSignal[]>;
}
