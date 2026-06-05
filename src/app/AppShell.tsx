import appLogo from "../assets/logo/NEW LOGO.png";
import { AnalyticsSection } from "../features/analytics/AnalyticsSection";
import { QuestionBankSection } from "../features/question-bank/QuestionBankSection";
import { SettingsSection } from "../features/settings/SettingsSection";
import { QuestionCollection, ValidationIssue } from "../features/test/questionCollectionTypes";
import { TestSection } from "../features/test/TestSection";
import { CompletedTestAttempt } from "../features/test/testTypes";
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
  collection,
  validationErrors,
  onImportCollectionFile,
  onClearValidationErrors,
  completedAttempts,
  onAddCompletedAttempt,
  onDeleteAllCompletedTests,
}: {
  t: Translator;
  section: SectionId;
  setSection: (section: SectionId) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  collection: QuestionCollection | null;
  validationErrors: ValidationIssue[];
  onImportCollectionFile: (file: File, merge?: boolean) => Promise<boolean>;
  onClearValidationErrors: () => void;
  completedAttempts: CompletedTestAttempt[];
  onAddCompletedAttempt: (attempt: CompletedTestAttempt) => void;
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
          {section !== "analytics" &&
          section !== "settings" &&
          section !== "test" &&
          section !== "questionBank" ? (
            <header className="content-header">
              <div>
                <h2>{activeItem ? t(activeItem.labelKey) : ""}</h2>
                <p>{activeItem ? t(activeItem.captionKey) : ""}</p>
              </div>
              <span className="tag">{t("app.tag")}</span>
            </header>
          ) : null}

          {section === "questionBank" ? (
            <QuestionBankSection
              t={t}
              collection={collection}
              validationErrors={validationErrors}
              onImportFile={onImportCollectionFile}
              onClearValidationErrors={onClearValidationErrors}
            />
          ) : null}
          {section === "test" ? (
            <TestSection
              t={t}
              collection={collection}
              onCompletedAttempt={onAddCompletedAttempt}
              onGoToQuestionBank={() => setSection("questionBank")}
            />
          ) : null}
          {section === "analytics" ? (
            <AnalyticsSection t={t} completedAttempts={completedAttempts} />
          ) : null}
          {section === "settings" ? (
            <SettingsSection
              t={t}
              language={language}
              setLanguage={setLanguage}
              theme={theme}
              setTheme={setTheme}
              answerCount={0}
              completedCount={completedAttempts.length}
              onDeleteAllAnswers={() => undefined}
              onDeleteAllCompletedTests={onDeleteAllCompletedTests}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
