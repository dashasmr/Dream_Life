"use client";

import { useEffect, useState } from "react";
import { AUTOMATION_SETTINGS_CHANGED_EVENT } from "@/services/automation/settingsStorage";

/**
 * Bumps when automation prefs change (same tab or cross-tab) so consumers can refresh derived lists.
 */
export function useAutomationPrefsEpoch(): number {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    function bump() {
      setEpoch((n) => n + 1);
    }
    window.addEventListener("storage", bump);
    window.addEventListener(AUTOMATION_SETTINGS_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(AUTOMATION_SETTINGS_CHANGED_EVENT, bump);
    };
  }, []);

  return epoch;
}
