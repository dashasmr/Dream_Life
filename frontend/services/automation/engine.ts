import type { AutomationContext, AutomationSink } from "@/services/automation/types";
import { AUTOMATION_RULES } from "@/services/automation/rules";
import { isAutomationRuleEnabledByUser } from "@/services/automation/settingsStorage";

export function createEmptyAutomationSink(): AutomationSink {
  return {
    notifications: [],
    recommendations: [],
    automationRiskSignals: [],
    positiveInsights: []
  };
}

export type RunAutomationOptions = {
  /** When set, overrides user prefs (e.g. tests). Otherwise uses saved Automation Settings. */
  isRuleEnabled?: (ruleId: string) => boolean;
};

/**
 * Runs all enabled automation rules once. UI and legacy helpers read from the returned sink.
 */
export function runAutomationEngine(ctx: AutomationContext, options?: RunAutomationOptions): AutomationSink {
  const sink = createEmptyAutomationSink();
  const userEnabled = options?.isRuleEnabled ?? isAutomationRuleEnabledByUser;
  for (const rule of AUTOMATION_RULES) {
    if (!rule.enabled) continue;
    if (!userEnabled(rule.id)) continue;
    if (rule.condition(ctx)) rule.action(ctx, sink);
  }
  return sink;
}
