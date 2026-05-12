"use client";

import { useCallback, useMemo, useState } from "react";
import { ui } from "@/lib/ui";
import { AUTOMATION_RULE_SETTING_CATALOG } from "@/services/automation/ruleSettingCatalog";
import type { AutomationSetting, AutomationSettingCategory } from "@/services/automation/settingsTypes";
import { getAutomationSettingsForUi, setAutomationRuleEnabled } from "@/services/automation/settingsStorage";

const CATEGORY_LABEL: Record<AutomationSettingCategory, string> = {
  cleaning: "Cleaning",
  focus: "Focus & productivity",
  goals: "Goals",
  insights: "Insights & finance nudges"
};

const CATEGORY_ORDER: AutomationSettingCategory[] = ["cleaning", "focus", "goals", "insights"];

function groupByCategory(settings: AutomationSetting[]): Map<AutomationSettingCategory, AutomationSetting[]> {
  const map = new Map<AutomationSettingCategory, AutomationSetting[]>();
  for (const cat of CATEGORY_ORDER) map.set(cat, []);
  for (const s of settings) {
    const list = map.get(s.category);
    if (list) list.push(s);
  }
  return map;
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C6A36B]/60 ${
        enabled ? "bg-[#C6A36B]" : "bg-[#2A2F36]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 block size-6 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
      <span className="sr-only">{enabled ? "On" : "Off"}</span>
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AutomationSetting[]>(() => getAutomationSettingsForUi());

  const refresh = useCallback(() => {
    setSettings(getAutomationSettingsForUi());
  }, []);

  const grouped = useMemo(() => groupByCategory(settings), [settings]);

  const toggle = useCallback((id: string, next: boolean) => {
    setAutomationRuleEnabled(id, next);
    refresh();
  }, [refresh]);

  const catalogEmpty = AUTOMATION_RULE_SETTING_CATALOG.length === 0;

  return (
    <div className={ui.contentClass}>
      <section className={ui.panelClass}>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className={ui.pageHint}>Control how Life OS runs background automations on this device.</p>

        <section className="mt-8 rounded-2xl border border-[#2A2F36] bg-[#0F1318] p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white">Automation Settings</h2>
          <p className={`mt-1 text-sm ${ui.mutedText}`}>
            Turn rules on or off. Preferences are stored in this browser (local storage).
          </p>

          {catalogEmpty ? (
            <p className={`mt-6 text-sm ${ui.mutedText}`}>No automation rules are configured yet.</p>
          ) : (
            <div className="mt-6 space-y-8">
              {CATEGORY_ORDER.map((cat) => {
                const rows = grouped.get(cat) ?? [];
                if (rows.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8A8F98]">
                      {CATEGORY_LABEL[cat]}
                    </h3>
                    <ul className="mt-3 divide-y divide-[#2A2F36] rounded-xl border border-[#2A2F36] bg-[#11151A]/80">
                      {rows.map((s) => (
                        <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white">{s.name}</p>
                            <p className={`mt-1 text-sm ${ui.mutedText}`}>{s.description}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
                            <span className="text-xs font-semibold uppercase tracking-wide text-[#C6A36B]">
                              {s.enabled ? "On" : "Off"}
                            </span>
                            <ToggleSwitch enabled={s.enabled} onToggle={() => toggle(s.id, !s.enabled)} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
