export type RiskSeverity = "low" | "medium" | "high";
export type RiskCategory = "focus" | "finance" | "environment";

export type RiskSignal = {
  id: string;
  severity: RiskSeverity;
  category: RiskCategory;
  message: string;
  detectedAt: string;
};
