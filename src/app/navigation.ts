export type SectionId = "questionBank" | "test" | "analytics" | "settings";

export type NavigationItem = {
  id: SectionId;
  labelKey: string;
  captionKey: string;
  icon: "questionBank" | "test" | "analytics" | "settings";
};

export const NAV_ITEMS: NavigationItem[] = [
  {
    id: "questionBank",
    labelKey: "nav.questionBank",
    captionKey: "nav.questionBankCaption",
    icon: "questionBank",
  },
  { id: "test", labelKey: "nav.test", captionKey: "nav.testCaption", icon: "test" },
  {
    id: "analytics",
    labelKey: "nav.analytics",
    captionKey: "nav.analyticsCaption",
    icon: "analytics",
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    captionKey: "nav.settingsCaption",
    icon: "settings",
  },
];
