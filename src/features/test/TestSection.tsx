import { useEffect, useMemo, useState } from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Toast } from "../../shared/components/Toast";
import { ActiveTestRecovery } from "../../services/persistence";
import { DeleteTestDefinitionModal } from "./definition/DeleteTestDefinitionModal";
import { SavedTestsList } from "./definition/SavedTestsList";
import { TestDefinitionFormModal } from "./definition/TestDefinitionFormModal";
import { useActiveTestRunner } from "./hooks/useActiveTestRunner";
import { usePdfExport } from "./hooks/usePdfExport";
import { useTestDefinitionForm } from "./hooks/useTestDefinitionForm";
import { DifficultyLevel, QuestionCollection } from "./questionCollectionTypes";
import { RecoveryModal } from "./recovery/RecoveryModal";
import { TestResultsView } from "./results/TestResultsView";
import { TestRunnerView } from "./runner/TestRunnerView";
import {
  ActiveTestAttempt,
  CompletedTestAttempt,
  RuntimeAnswer,
  RuntimeQueueItem,
  TestDefinition,
} from "./testTypes";
import { getMatchingQuestions } from "./testUtils";
import { getEffectiveTimeLimitMinutes } from "./testRuntimeUtils";
import "./test.css";

type RatedDifficulty = Exclude<DifficultyLevel, "unrated">;

const DIFFICULTY_OPTIONS: Array<{ value: RatedDifficulty; labelKey: string }> = [
  { value: "low", labelKey: "test.difficultyLow" },
  { value: "medium", labelKey: "test.difficultyMedium" },
  { value: "high", labelKey: "test.difficultyHigh" },
];

export function TestSection({
  t,
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
  onCompletedAttempt,
  onUpdateQuestionDifficulty,
  onGoToQuestionBank,
}: {
  t: Translator;
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
  onCompletedAttempt: (
    attempt: CompletedTestAttempt,
    queue: RuntimeQueueItem[],
    submittedAnswers: Record<string, RuntimeAnswer | undefined>,
  ) => void;
  onUpdateQuestionDifficulty: (questionId: string, difficulty: DifficultyLevel) => void;
  onGoToQuestionBank: () => void;
}) {
  const [toast, setToast] = useState<null | { message: string; variant: "success" | "error" }>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<TestDefinition | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const bankQuestions = useMemo(() => collection?.questions || [], [collection]);
  const {
    formOpen,
    setFormOpen,
    formState,
    setFormState,
    editingTestId,
    titleInputRef,
    questionLimitInputRef,
    categoriesTriggerRef,
    timeLimitInputRef,
    penaltyInputRef,
    categoryOptions,
    subcategoryOptions,
    openCreate,
    openEdit,
    formValidation,
    showErrors,
    saveDefinition,
    updateIncludedCategories,
  } = useTestDefinitionForm({ bankQuestions, definitions, onSaveDefinition });

  const { exportingPdfTestId, exportPdfDefinition } = usePdfExport({
    t,
    onGenerateQuestions,
    setToast,
  });

  const {
    activeAttempt,
    resultAttempt,
    setResultAttempt,
    runDefinition,
    continueRecoveredTest,
    activeRunnerViewProps,
  } = useActiveTestRunner({
    t,
    collection,
    definitions,
    onGenerateQuestions,
    pendingActiveRecovery,
    onSaveActiveRecovery,
    onClearActiveRecovery,
    onCompletedAttempt,
    onUpdateQuestionDifficulty,
    setToast,
  });

  const recoveryModal =
    (pendingActiveRecovery || activeRecoveryLoadError) && !activeAttempt && !resultAttempt ? (
      <RecoveryModal
        t={t}
        pendingActiveRecovery={pendingActiveRecovery}
        activeRecoveryLoadError={activeRecoveryLoadError}
        onContinueRecoveredTest={continueRecoveredTest}
        onDiscardActiveRecovery={onDiscardActiveRecovery}
        formatDuration={formatDuration}
      />
    ) : null;

  if (!collection) {
    return (
      <div className="test-empty-state-wrap">
        {recoveryModal}
        <Card
          title={t("test.emptyQuestionBankTitle")}
          subtitle={t("test.emptyQuestionBankSubtitle")}
          className="test-empty-state-card"
        >
          <p className="placeholder-note">{t("test.emptyQuestionBankBody")}</p>
          <div className="test-empty-state-action">
            <Button onClick={onGoToQuestionBank}>{t("test.goToQuestionBank")}</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (activeRunnerViewProps) {
    return (
      <TestRunnerView
        t={t}
        {...activeRunnerViewProps}
        difficultyOptions={DIFFICULTY_OPTIONS}
        formatDuration={formatDuration}
      />
    );
  }

  if (resultAttempt) {
    const { result, definition, reason } = resultAttempt;
    return (
      <TestResultsView
        t={t}
        result={result}
        definition={definition}
        reason={reason}
        onReturnToHome={() => setResultAttempt(null)}
        formatDateTime={formatDateTime}
        formatDuration={formatDuration}
      />
    );
  }

  return (
    <div className="view-grid test-home-grid">
      {recoveryModal}
      <div className="test-home-content">
        <div className="configure-cta-wrap">
          <button type="button" className="configure-cta" onClick={openCreate}>
            {t("test.configureNewTest")}
          </button>
        </div>

        <Card
          title={t("test.savedTests")}
          subtitle={t("test.workspaceSubtitle")}
          className="test-home-card saved-tests-card"
        >
          <SavedTestsList
            t={t}
            definitions={definitions}
            exportingPdfTestId={exportingPdfTestId}
            getMatchingCount={(definition) =>
              getMatchingQuestions(definition, collection.questions).length
            }
            getTimeLimitMinutes={getEffectiveTimeLimitMinutes}
            onRunDefinition={(definition) => void runDefinition(definition)}
            onExportPdfDefinition={(definition) => void exportPdfDefinition(definition)}
            onOpenEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </Card>
      </div>

      {formOpen ? (
        <TestDefinitionFormModal
          t={t}
          editingTestId={editingTestId}
          formState={formState}
          setFormState={setFormState}
          saveDefinition={saveDefinition}
          showErrors={showErrors}
          formValidation={formValidation}
          categoryOptions={categoryOptions}
          subcategoryOptions={subcategoryOptions}
          updateIncludedCategories={updateIncludedCategories}
          titleInputRef={titleInputRef}
          questionLimitInputRef={questionLimitInputRef}
          categoriesTriggerRef={categoriesTriggerRef}
          timeLimitInputRef={timeLimitInputRef}
          penaltyInputRef={penaltyInputRef}
          onCancel={() => setFormOpen(false)}
        />
      ) : null}

      <DeleteTestDefinitionModal
        t={t}
        deleteTarget={deleteTarget}
        onConfirm={() => {
          if (!deleteTarget) return;
          onDeleteDefinition(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
          closeLabel={t("test.toastClose")}
        />
      ) : null}
    </div>
  );
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainingSeconds = safe % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString();
}
