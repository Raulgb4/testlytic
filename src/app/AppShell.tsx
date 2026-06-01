import appLogo from "../assets/logo/NEW LOGO.png";
import { AnalyticsSection } from "../features/analytics/AnalyticsSection";
import { MockAnswerHistoryRow, MockCompletedAttempt } from "../features/analytics/analyticsTypes";
import { SettingsSection } from "../features/settings/SettingsSection";
import { TestSection } from "../features/test/TestSection";
import { Language } from "../i18n";
import { NavItem } from "../shared/components/NavItem";
import { NAV_ITEMS, SectionId } from "./navigation";
import { Translator } from "./types";

type ThemeMode = "dark" | "light";

export function AppShell({
  t,
  section,
  setSection,
  theme,
  setTheme,
  language,
  setLanguage,
  completedAttempts,
  answerHistory,
  onDeleteAllAnswers,
  onDeleteAllCompletedTests,
}: {
  t: Translator;
  section: SectionId;
  setSection: (section: SectionId) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  completedAttempts: MockCompletedAttempt[];
  answerHistory: MockAnswerHistoryRow[];
  onDeleteAllAnswers: () => void;
  onDeleteAllCompletedTests: () => void;
}) {
  const activeItem = NAV_ITEMS.find((item) => item.id === section);

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <img src={appLogo} alt={`${t("app.name")} logo`} className="brand-logo" />
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <nav className="nav-list" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                label={t(item.labelKey)}
                icon={item.icon}
                active={item.id === section}
                onClick={() => setSection(item.id)}
              />
            ))}
          </nav>
        </aside>

        <main
          className={
            section === "analytics" ? "content-area analytics-content-area" : "content-area"
          }
        >
          {section !== "analytics" && section !== "settings" && section !== "test" ? (
            <header className="content-header">
              <div>
                <h2>{activeItem ? t(activeItem.labelKey) : ""}</h2>
                <p>{activeItem ? t(activeItem.captionKey) : ""}</p>
              </div>
              <span className="tag">{t("app.tag")}</span>
            </header>
          ) : null}

          {section === "test" ? <TestSection t={t} /> : null}
          {section === "analytics" ? (
            <AnalyticsSection
              t={t}
              completedAttempts={completedAttempts}
              answerHistory={answerHistory}
            />
          ) : null}
          {section === "settings" ? (
            <SettingsSection
              t={t}
              language={language}
              setLanguage={setLanguage}
              theme={theme}
              setTheme={setTheme}
              answerCount={answerHistory.length}
              completedCount={completedAttempts.length}
              onDeleteAllAnswers={onDeleteAllAnswers}
              onDeleteAllCompletedTests={onDeleteAllCompletedTests}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
