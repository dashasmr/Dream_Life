import { AUTOMATION_RULE_SETTING_CATALOG, isKnownAutomationRuleId } from "@/services/automation/ruleSettingCatalog";
import type { AutomationSetting } from "@/services/automation/settingsTypes";

export const AUTOMATION_SETTINGS_STORAGE_KEY = "lifeos-automation-settings-v1";

export const AUTOMATION_SETTINGS_CHANGED_EVENT = "lifeos-automation-settings-changed";

type StoredShape = {
  /** Per-rule enabled flag; missing keys fall back to catalog `defaultEnabled`. */
  rules: Record<string, boolean>;
};

function defaultStoredShape(): StoredShape {
  return { rules: {} };
}

function readRaw(): StoredShape {
  if (typeof window === "undefined") return defaultStoredShape();
  try {
    const raw = window.localStorage.getItem(AUTOMATION_SETTINGS_STORAGE_KEY);
    if (!raw) return defaultStoredShape();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultStoredShape();
    const rules = (parsed as { rules?: unknown }).rules;
    if (!rules || typeof rules !== "object") return defaultStoredShape();
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(rules)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return { rules: out };
  } catch {
    return defaultStoredShape();
  }
}

function writeRaw(data: StoredShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTOMATION_SETTINGS_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(AUTOMATION_SETTINGS_CHANGED_EVENT));
  } catch {
    /* quota / private mode */
  }
}

function effectiveEnabledForId(ruleId: string): boolean {
  const meta = AUTOMATION_RULE_SETTING_CATALOG.find((r) => r.id === ruleId);
  const fallback = meta?.defaultEnabled ?? true;
  if (typeof window === "undefined") return fallback;
  const v = readRaw().rules[ruleId];
  return v === undefined ? fallback : v;
}

/**
 * Used by the automation engine on the client. Unknown / uncatalogued rules default to enabled.
 */
export function isAutomationRuleEnabledByUser(ruleId: string): boolean {
  if (!isKnownAutomationRuleId(ruleId)) return true;
  return effectiveEnabledForId(ruleId);
}

export function getAutomationSettingsForUi(): AutomationSetting[] {
  const stored = readRaw().rules;
  return AUTOMATION_RULE_SETTING_CATALOG.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    enabled: stored[row.id] === undefined ? row.defaultEnabled : stored[row.id]
  }));
}

export function setAutomationRuleEnabled(ruleId: string, enabled: boolean): void {
  if (!AUTOMATION_RULE_SETTING_CATALOG.some((r) => r.id === ruleId)) return;
  const prev = readRaw();
  writeRaw({ rules: { ...prev.rules, [ruleId]: enabled } });
}
