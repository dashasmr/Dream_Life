export type AutomationSettingCategory = "cleaning" | "focus" | "goals" | "insights";

export type AutomationSetting = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: AutomationSettingCategory;
};
