import appLogo from "../assets/logo/NEW LOGO.png";
import { AnalyticsSection } from "../features/analytics/AnalyticsSection";
import { QuestionBankSection } from "../features/question-bank/QuestionBankSection";
import { SettingsSection } from "../features/settings/SettingsSection";
import {
  ImportCollectionResult,
  ImportConflictResolution,
  ImportProcessingState,
  PendingImportConflict,
} from "../features/test/questionCollectionImport";
import {
  QuestionAnalytics,
  QuestionCollection,
  ValidationIssue,
} from "../features/test/questionCollectionTypes";
import { TestSection } from "../features/test/TestSection";
import {
  CompletedTestAttempt,
  ActiveTestAttempt,
  RuntimeAnswer,
  RuntimeQueueItem,
  TestDefinition,
} from "../features/test/testTypes";
import { ActiveTestRecovery } from "../services/persistence";
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
  definitions,
  onSaveDefinition,
  onDeleteDefinition,
  onGenerateQuestions,
  pendingActiveRecovery,
  activeRecoveryLoadError,
  onSaveActiveRecovery,
  onClearActiveRecovery,
  onDiscardActiveRecovery,
  validationErrors,
  importProcessing,
  pendingImportConflict,
  onImportCollectionFile,
  onClearValidationErrors,
  onResolveImportConflict,
  onCancelImportConflict,
  onResetQuestionBank,
  completedAttempts,
  onAddCompletedAttempt,
  onDeleteAllCompletedTests,
  onUpdateQuestionDifficulty,
}: {
  t: Translator;
  section: SectionId;
  setSection: (section: SectionId) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  collection: QuestionCollection | null;
  definitions: TestDefinition[];
  onSaveDefinition: (definition: TestDefinition) => void;
  onDeleteDefinition: (definition: TestDefinition) => void;
  onGenerateQuestions: (definition: TestDefinition) => Promise<QuestionCollection["questions"]>;
  pendingActiveRecovery: ActiveTestRecovery | null;
  activeRecoveryLoadError: boolean;
  onSaveActiveRecovery: (definition: TestDefinition, activeAttempt: ActiveTestAttempt) => void;
  onClearActiveRecovery: () => void;
  onDiscardActiveRecovery: () => void;
  validationErrors: ValidationIssue[];
  importProcessing: ImportProcessingState;
  pendingImportConflict: PendingImportConflict | null;
  onImportCollectionFile: (file: File, merge?: boolean) => Promise<ImportCollectionResult>;
  onClearValidationErrors: () => void;
  onResolveImportConflict: (
    resolution: ImportConflictResolution,
  ) => Promise<{ status: "imported" } | { status: "cancelled" }>;
  onCancelImportConflict: () => { status: "cancelled" };
  onResetQuestionBank: () => void;
  completedAttempts: CompletedTestAttempt[];
  onAddCompletedAttempt: (
    attempt: CompletedTestAttempt,
    queue: RuntimeQueueItem[],
    submittedAnswers: Record<string, RuntimeAnswer | undefined>,
  ) => void;
  onDeleteAllCompletedTests: () => void;
  onUpdateQuestionDifficulty: (
    questionId: string,
    difficulty: QuestionAnalytics["userDeclaredDifficulty"],
  ) => void;
}) {
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
          {section === "questionBank" ? (
            <QuestionBankSection
              t={t}
              collection={collection}
              validationErrors={validationErrors}
              importProcessing={importProcessing}
              pendingImportConflict={pendingImportConflict}
              onImportFile={onImportCollectionFile}
              onClearValidationErrors={onClearValidationErrors}
              onResolveImportConflict={onResolveImportConflict}
              onCancelImportConflict={onCancelImportConflict}
            />
          ) : null}
          {section === "test" ? (
            <TestSection
              t={t}
              collection={collection}
              definitions={definitions}
              onSaveDefinition={onSaveDefinition}
              onDeleteDefinition={onDeleteDefinition}
              onGenerateQuestions={onGenerateQuestions}
              pendingActiveRecovery={pendingActiveRecovery}
              activeRecoveryLoadError={activeRecoveryLoadError}
              onSaveActiveRecovery={onSaveActiveRecovery}
              onClearActiveRecovery={onClearActiveRecovery}
              onDiscardActiveRecovery={onDiscardActiveRecovery}
              onCompletedAttempt={onAddCompletedAttempt}
              onUpdateQuestionDifficulty={onUpdateQuestionDifficulty}
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
              questionCount={collection?.summary.totalQuestions || 0}
              answerCount={0}
              completedCount={completedAttempts.length}
              onDeleteAllAnswers={() => undefined}
              onResetQuestionBank={onResetQuestionBank}
              onDeleteAllCompletedTests={onDeleteAllCompletedTests}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
