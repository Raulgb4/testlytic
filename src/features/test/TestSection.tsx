import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Toast } from "../../shared/components/Toast";
import { ActiveTestRecovery } from "../../services/persistence";
import { DeleteTestDefinitionModal } from "./definition/DeleteTestDefinitionModal";
import { SavedTestsList } from "./definition/SavedTestsList";
import { TestDefinitionFormModal, TestFormState } from "./definition/TestDefinitionFormModal";
import { CollectionQuestion, DifficultyLevel, QuestionCollection } from "./questionCollectionTypes";
import { RecoveryModal } from "./recovery/RecoveryModal";
import { TestResultsView } from "./results/TestResultsView";
import { TestRunnerView } from "./runner/TestRunnerView";
import {
  ActiveTestAttempt,
  CompletedTestAttempt,
  RuntimeAnswer,
  RuntimeQuestion,
  RuntimeQueueItem,
  TestAttempt,
  TestDefinition,
} from "./testTypes";
import {
  buildRuntimeQuestions,
  calculateAttemptResult,
  getCategoryOptions,
  getMatchingQuestions,
  getSubcategoryOptions,
  isExactSetMatch,
} from "./testUtils";
import {
  getEffectiveTimeLimitMinutes,
  getFinishSummary,
  isTimeLimitEnabled,
} from "./testRuntimeUtils";
import "./test.css";

type RatedDifficulty = Exclude<DifficultyLevel, "unrated">;

const DIFFICULTY_OPTIONS: Array<{ value: RatedDifficulty; labelKey: string }> = [
  { value: "low", labelKey: "test.difficultyLow" },
  { value: "medium", labelKey: "test.difficultyMedium" },
  { value: "high", labelKey: "test.difficultyHigh" },
];

const INITIAL_FORM: TestFormState = {
  title: "",
  questionLimit: 20,
  includedCategories: [],
  includedSubcategories: [],
  allowUnanswered: true,
  timeLimitEnabled: false,
  negativeMarkingEnabled: false,
  penaltyPerIncorrectAnswer: 0.25,
  timeLimitMinutes: 30,
};

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
  const [formOpen, setFormOpen] = useState(false);
  const [exportingPdfTestId, setExportingPdfTestId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TestFormState>(INITIAL_FORM);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const questionLimitInputRef = useRef<HTMLInputElement | null>(null);
  const categoriesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const timeLimitInputRef = useRef<HTMLInputElement | null>(null);
  const penaltyInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestDefinition | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ActiveTestAttempt | null>(null);
  const [recoveredDefinition, setRecoveredDefinition] = useState<TestDefinition | null>(null);
  const [resultAttempt, setResultAttempt] = useState<{
    result: TestAttempt;
    definition: TestDefinition;
    reason: "manual" | "timeout";
  } | null>(null);
  const [finishWarning, setFinishWarning] = useState("");
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [recoveryBaseTimestamp, setRecoveryBaseTimestamp] = useState(() => Date.now());
  const [difficultyModalOpen, setDifficultyModalOpen] = useState(false);
  const [difficultyTarget, setDifficultyTarget] = useState<{
    questionId: string;
    questionText: string;
  } | null>(null);
  const [difficultySelection, setDifficultySelection] = useState<RatedDifficulty>("medium");
  const completionInFlightRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activeAttempt) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt]);

  useEffect(() => {
    if (activeAttempt) {
      completionInFlightRef.current = false;
    }
  }, [activeAttempt]);

  useEffect(() => {
    if (activeAttempt) return;
    setDifficultyModalOpen(false);
    setDifficultyTarget(null);
  }, [activeAttempt]);

  const bankQuestions = useMemo(() => collection?.questions || [], [collection]);
  const categoryOptions = useMemo(() => getCategoryOptions(bankQuestions), [bankQuestions]);
  const subcategoryOptions = useMemo(
    () => getSubcategoryOptions(bankQuestions, formState.includedCategories),
    [bankQuestions, formState.includedCategories],
  );
  useEffect(() => {
    if (!formOpen) return;
    setFormState((current) => {
      const availableCategories = new Set(categoryOptions);
      const nextCategories = current.includedCategories.filter((category) =>
        availableCategories.has(category),
      );
      const allowedSubcategories = getSubcategoryOptions(bankQuestions, nextCategories);
      const availableSubcategories = new Set(allowedSubcategories);
      const nextSubcategories = current.includedSubcategories.filter((subcategory) =>
        availableSubcategories.has(subcategory),
      );

      if (
        isSameStringList(nextCategories, current.includedCategories) &&
        isSameStringList(nextSubcategories, current.includedSubcategories)
      ) {
        return current;
      }

      return {
        ...current,
        includedCategories: nextCategories,
        includedSubcategories: nextSubcategories,
      };
    });
  }, [bankQuestions, categoryOptions, formOpen]);

  const openCreate = () => {
    setEditingTestId(null);
    setFormTouched(false);
    setFormState({
      ...INITIAL_FORM,
      questionLimit: Math.min(20, Math.max(1, bankQuestions.length)),
      includedCategories: categoryOptions.length > 0 ? [categoryOptions[0]] : [],
    });
    setFormOpen(true);
  };

  const openEdit = (definition: TestDefinition) => {
    setEditingTestId(definition.id);
    setFormTouched(false);
    setFormState({
      title: definition.title,
      questionLimit: definition.questionLimit,
      includedCategories: definition.includedCategories,
      includedSubcategories: definition.includedSubcategories || [],
      allowUnanswered: definition.allowUnanswered,
      timeLimitEnabled: isTimeLimitEnabled(definition),
      negativeMarkingEnabled: definition.negativeMarkingEnabled,
      penaltyPerIncorrectAnswer: definition.penaltyPerIncorrectAnswer,
      timeLimitMinutes: definition.timeLimitMinutes,
    });
    setFormOpen(true);
  };

  const formValidation = validateDefinitionForm(formState, bankQuestions);
  const showErrors = formTouched;

  const saveDefinition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormTouched(true);
    if (formValidation.summary.length > 0) {
      const firstError = formValidation.order.find((key) => Boolean(formValidation.errors[key]));
      if (firstError === "title") titleInputRef.current?.focus();
      if (firstError === "questionLimit") questionLimitInputRef.current?.focus();
      if (firstError === "includedCategories") categoriesTriggerRef.current?.focus();
      if (firstError === "timeLimitMinutes") timeLimitInputRef.current?.focus();
      if (firstError === "penaltyPerIncorrectAnswer") penaltyInputRef.current?.focus();
      return;
    }

    const now = new Date().toISOString();
    const generatedId = `test-${Date.now()}`;
    const payload: TestDefinition = {
      id: editingTestId || generatedId,
      title: formState.title.trim(),
      questionLimit: formState.questionLimit,
      includedCategories: formState.includedCategories,
      includedSubcategories: formState.includedSubcategories,
      allowUnanswered: formState.allowUnanswered,
      timeLimitEnabled: formState.timeLimitEnabled,
      negativeMarkingEnabled: formState.negativeMarkingEnabled,
      penaltyPerIncorrectAnswer: formState.negativeMarkingEnabled
        ? formState.penaltyPerIncorrectAnswer
        : 0,
      timeLimitMinutes: formState.timeLimitEnabled ? formState.timeLimitMinutes : 0,
      createdAt: editingTestId
        ? definitions.find((item) => item.id === editingTestId)?.createdAt || now
        : now,
      updatedAt: now,
    };

    onSaveDefinition(payload);
    setFormOpen(false);
  };

  const updateIncludedCategories = (next: string[]) => {
    const allowedSubcategories = getSubcategoryOptions(bankQuestions, next);
    setFormState((current) => ({
      ...current,
      includedCategories: next,
      includedSubcategories: current.includedSubcategories.filter((item) =>
        allowedSubcategories.includes(item),
      ),
    }));
  };

  const runDefinition = async (definition: TestDefinition) => {
    const generatedQuestions = await onGenerateQuestions(definition);
    const runtimeQuestions = buildRuntimeQuestions(definition, generatedQuestions);
    if (runtimeQuestions.length === 0) {
      setToast({ message: t("test.noMatchingQuestions"), variant: "error" });
      return;
    }
    const nextAttempt: ActiveTestAttempt = {
      id: `active-${Date.now()}`,
      testId: definition.id,
      startedAt: new Date().toISOString(),
      savedElapsedSeconds: 0,
      queue: runtimeQuestions.map((question, index) => ({
        queueId: `${question.id}-attempt-1-${index}`,
        sourceQuestionId: question.id,
        retryNumber: 0,
        question,
      })),
      originalQuestionCount: runtimeQuestions.length,
      submittedAnswers: {},
      draftSelections: {},
      currentQueueIndex: 0,
    };
    completionInFlightRef.current = false;
    setFinishWarning("");
    setFinishConfirmOpen(false);
    setResultAttempt(null);
    setDifficultyModalOpen(false);
    setDifficultyTarget(null);
    setRecoveredDefinition(null);
    setRecoveryBaseTimestamp(Date.now());
    setActiveAttempt(nextAttempt);
    onSaveActiveRecovery(definition, nextAttempt);
  };

  const exportPdfDefinition = async (definition: TestDefinition) => {
    if (exportingPdfTestId) return;
    setExportingPdfTestId(definition.id);
    try {
      let generatedQuestions: QuestionCollection["questions"];
      try {
        generatedQuestions = await onGenerateQuestions(definition);
      } catch (error) {
        console.error("Failed to generate PDF questions", error);
        setToast({ message: t("test.pdfExportQuestionsError"), variant: "error" });
        return;
      }

      let runtimeQuestions: RuntimeQuestion[];
      try {
        runtimeQuestions = buildRuntimeQuestions(definition, generatedQuestions);
      } catch (error) {
        console.error("Failed to build PDF runtime questions", error);
        setToast({ message: t("test.pdfExportQuestionsError"), variant: "error" });
        return;
      }

      if (runtimeQuestions.length === 0) {
        setToast({ message: t("test.noMatchingQuestions"), variant: "error" });
        return;
      }

      const { saveExamPdf } = await import("./pdf/examPdfExport");
      const result = await saveExamPdf({
        definition,
        runtimeQuestions,
        generatedAt: new Date().toISOString(),
      });

      if (result.status === "saved") {
        setToast({ message: t("test.pdfExportSavedSuccess"), variant: "success" });
      }
      if (result.status === "renderError") {
        setToast({ message: t("test.pdfExportRenderError"), variant: "error" });
      }
      if (result.status === "dialogError" || result.status === "writeError") {
        setToast({ message: t("test.pdfExportWriteError"), variant: "error" });
      }
    } catch (error) {
      console.error("Failed to export PDF", error);
      setToast({ message: t("test.pdfExportSavedError"), variant: "error" });
    } finally {
      setExportingPdfTestId(null);
    }
  };

  const persistActiveAttempt = (nextAttempt: ActiveTestAttempt) => {
    const definition =
      definitions.find((item) => item.id === nextAttempt.testId) || recoveredDefinition;
    if (!definition) return nextAttempt;

    const extraElapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - recoveryBaseTimestamp) / 1000),
    );
    const attemptWithTimer = {
      ...nextAttempt,
      savedElapsedSeconds: nextAttempt.savedElapsedSeconds + extraElapsedSeconds,
    };
    setRecoveryBaseTimestamp(Date.now());
    onSaveActiveRecovery(definition, attemptWithTimer);
    return attemptWithTimer;
  };

  const selectDraftAnswer = (queueItem: RuntimeQueueItem, optionId: string) => {
    if (!activeAttempt || completionInFlightRef.current) return;
    if (activeAttempt.submittedAnswers[queueItem.queueId]) return;

    const current = activeAttempt.draftSelections[queueItem.queueId] || [];
    let selectedOptionIds = current;
    if (queueItem.question.questionType === "single_choice") {
      selectedOptionIds = [optionId];
    } else {
      selectedOptionIds = selectedOptionIds.includes(optionId)
        ? selectedOptionIds.filter((id) => id !== optionId)
        : [...selectedOptionIds, optionId];
    }

    const nextAttempt = persistActiveAttempt({
      ...activeAttempt,
      draftSelections: {
        ...activeAttempt.draftSelections,
        [queueItem.queueId]: selectedOptionIds,
      },
    });
    setActiveAttempt(nextAttempt);
    setFinishWarning("");
  };

  const submitCurrentAnswer = () => {
    if (!activeAttempt || completionInFlightRef.current) return;
    const queueItem = activeAttempt.queue[activeAttempt.currentQueueIndex];
    if (!queueItem || activeAttempt.submittedAnswers[queueItem.queueId]) return;
    const selectedOptionIds = activeAttempt.draftSelections[queueItem.queueId] || [];

    const isCorrect =
      selectedOptionIds.length > 0 &&
      isExactSetMatch(selectedOptionIds, queueItem.question.correctOptions);
    const runtimeAnswer: RuntimeAnswer = {
      selectedOptionIds,
      isCorrect,
      answeredAt: new Date().toISOString(),
      attemptNumber: queueItem.retryNumber + 1,
    };

    const nextSubmittedAnswers = {
      ...activeAttempt.submittedAnswers,
      [queueItem.queueId]: runtimeAnswer,
    };
    const nextQueue = isCorrect
      ? activeAttempt.queue
      : [
          ...activeAttempt.queue,
          {
            ...queueItem,
            queueId: `${queueItem.sourceQuestionId}-attempt-${Date.now()}-${activeAttempt.queue.length}`,
            retryNumber: queueItem.retryNumber + 1,
          },
        ];

    const nextAttempt = persistActiveAttempt({
      ...activeAttempt,
      queue: nextQueue,
      submittedAnswers: nextSubmittedAnswers,
    });
    setActiveAttempt(nextAttempt);
    setFinishWarning("");
  };

  const goToPreviousQuestion = () => {
    if (!activeAttempt || completionInFlightRef.current) return;
    const nextAttempt = persistActiveAttempt({
      ...activeAttempt,
      currentQueueIndex: Math.max(0, activeAttempt.currentQueueIndex - 1),
    });
    setActiveAttempt(nextAttempt);
    setFinishWarning("");
  };

  const goToNextQuestion = () => {
    if (!activeAttempt || completionInFlightRef.current) return;
    const nextAttempt = persistActiveAttempt({
      ...activeAttempt,
      currentQueueIndex: Math.min(
        activeAttempt.queue.length - 1,
        activeAttempt.currentQueueIndex + 1,
      ),
    });
    setActiveAttempt(nextAttempt);
    setFinishWarning("");
  };

  const activeDefinition = activeAttempt
    ? definitions.find((item) => item.id === activeAttempt.testId) || recoveredDefinition
    : null;
  const finishSummary = activeAttempt ? getFinishSummary(activeAttempt) : null;

  const completeActiveTest = (reason: "manual" | "timeout") => {
    if (!activeAttempt || !activeDefinition || completionInFlightRef.current) return;
    completionInFlightRef.current = true;
    const extraElapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - recoveryBaseTimestamp) / 1000),
    );
    const completedAttempt = {
      ...activeAttempt,
      savedElapsedSeconds: activeAttempt.savedElapsedSeconds + extraElapsedSeconds,
    };
    const result = calculateAttemptResult(completedAttempt, activeDefinition);
    setFinishConfirmOpen(false);
    setFinishWarning("");
    setDifficultyModalOpen(false);
    setDifficultyTarget(null);
    setResultAttempt({ result, definition: activeDefinition, reason });
    onCompletedAttempt(result, completedAttempt.queue, completedAttempt.submittedAnswers);
    onClearActiveRecovery();
    setActiveAttempt(null);
  };

  const continueRecoveredTest = () => {
    if (!pendingActiveRecovery) return;
    setRecoveredDefinition(pendingActiveRecovery.testDefinition);
    completionInFlightRef.current = false;
    setFinishWarning("");
    setFinishConfirmOpen(false);
    setResultAttempt(null);
    setDifficultyModalOpen(false);
    setDifficultyTarget(null);
    setRecoveryBaseTimestamp(Date.now());
    setActiveAttempt({
      ...pendingActiveRecovery.activeAttempt,
      savedElapsedSeconds: pendingActiveRecovery.activeAttempt.savedElapsedSeconds ?? 0,
    });
  };

  const getQuestionDifficulty = (questionId: string) => {
    return (
      collection?.questions.find((question) => question.id === questionId)?.analytics
        .userDeclaredDifficulty ?? "unrated"
    );
  };

  const getDifficultyLabel = (difficulty: DifficultyLevel) => {
    switch (difficulty) {
      case "low":
        return t("test.difficultyLow");
      case "medium":
        return t("test.difficultyMedium");
      case "high":
        return t("test.difficultyHigh");
      default:
        return t("test.difficultyUnrated");
    }
  };

  const openDifficultyModal = (queueItem: RuntimeQueueItem) => {
    const currentDifficulty = getQuestionDifficulty(queueItem.sourceQuestionId);
    setDifficultySelection(currentDifficulty === "unrated" ? "medium" : currentDifficulty);
    setDifficultyTarget({
      questionId: queueItem.sourceQuestionId,
      questionText: queueItem.question.question,
    });
    setDifficultyModalOpen(true);
  };

  const closeDifficultyModal = () => {
    setDifficultyModalOpen(false);
    setDifficultyTarget(null);
  };

  const saveQuestionDifficulty = () => {
    if (!difficultyTarget) return;
    onUpdateQuestionDifficulty(difficultyTarget.questionId, difficultySelection);
    closeDifficultyModal();
  };

  const requestFinishConfirmation = () => {
    if (!activeAttempt || !activeDefinition || !finishSummary || completionInFlightRef.current)
      return;
    if (!activeDefinition.allowUnanswered && finishSummary.unanswered > 0) {
      setFinishWarning(t("test.finishWarning", { count: finishSummary.unanswered }));
    } else {
      setFinishWarning("");
    }
    setFinishConfirmOpen(true);
  };

  useEffect(() => {
    if (!activeAttempt || !activeDefinition) return;
    if (getEffectiveTimeLimitMinutes(activeDefinition) <= 0) return;
    const elapsedSeconds =
      activeAttempt.savedElapsedSeconds +
      Math.max(0, Math.floor((nowMs - recoveryBaseTimestamp) / 1000));
    const remainingSeconds = getEffectiveTimeLimitMinutes(activeDefinition) * 60 - elapsedSeconds;
    if (remainingSeconds > 0) return;
    completeActiveTest("timeout");
  }, [activeAttempt, activeDefinition, nowMs, recoveryBaseTimestamp]);

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

  if (activeAttempt) {
    const currentQueueItem = activeAttempt.queue[activeAttempt.currentQueueIndex];
    const currentQuestion = currentQueueItem.question;
    const currentAnswer = activeAttempt.submittedAnswers[currentQueueItem.queueId];
    const currentDraft = activeAttempt.draftSelections[currentQueueItem.queueId] || [];
    const currentDifficulty = getQuestionDifficulty(currentQueueItem.sourceQuestionId);
    const allowUnanswered = activeDefinition?.allowUnanswered || false;
    const hasSubmittedCurrentAnswer = Boolean(currentAnswer);
    const hasNextQuestion = activeAttempt.currentQueueIndex < activeAttempt.queue.length - 1;
    const showAnswer = !hasSubmittedCurrentAnswer;
    const showNext = hasNextQuestion && (allowUnanswered || hasSubmittedCurrentAnswer);
    const originalCounters = activeDefinition
      ? getOriginalAttemptCounters(activeAttempt, activeDefinition)
      : {
          correct: 0,
          wrong: 0,
          answered: 0,
          total: activeAttempt.originalQuestionCount,
          gradeOutOf10: 0,
        };
    const elapsedSeconds =
      activeAttempt.savedElapsedSeconds +
      Math.max(0, Math.floor((nowMs - recoveryBaseTimestamp) / 1000));
    const effectiveTimeLimitMinutes = activeDefinition
      ? getEffectiveTimeLimitMinutes(activeDefinition)
      : 0;
    const timeUrgency = getTimeUrgency(elapsedSeconds, effectiveTimeLimitMinutes);
    const visibleQuestionPosition = Math.min(
      activeAttempt.currentQueueIndex + 1,
      activeAttempt.originalQuestionCount,
    );
    const visibleCategory = currentQuestion.questionSubcategory
      ? `${currentQuestion.questionCategory} / ${currentQuestion.questionSubcategory}`
      : currentQuestion.questionCategory;
    const answerExplanation = currentQuestion.correctAnswerExplanation?.trim() || "";
    const difficultyButtonLabel =
      currentDifficulty === "unrated"
        ? t("test.rateDifficulty")
        : `${t("test.rateDifficulty")} (${getDifficultyLabel(currentDifficulty)})`;

    return (
      <TestRunnerView
        t={t}
        activeAttempt={activeAttempt}
        activeDefinition={activeDefinition}
        currentQueueItem={currentQueueItem}
        currentAnswer={currentAnswer}
        currentDraft={currentDraft}
        hasSubmittedCurrentAnswer={hasSubmittedCurrentAnswer}
        showAnswer={showAnswer}
        showNext={showNext}
        allowUnanswered={allowUnanswered}
        originalCounters={originalCounters}
        elapsedSeconds={elapsedSeconds}
        effectiveTimeLimitMinutes={effectiveTimeLimitMinutes}
        timeUrgency={timeUrgency}
        visibleQuestionPosition={visibleQuestionPosition}
        visibleCategory={visibleCategory}
        answerExplanation={answerExplanation}
        difficultyButtonLabel={difficultyButtonLabel}
        finishWarning={finishWarning}
        finishConfirmOpen={finishConfirmOpen}
        finishSummary={finishSummary}
        difficultyModalOpen={difficultyModalOpen}
        difficultyTarget={difficultyTarget}
        difficultyOptions={DIFFICULTY_OPTIONS}
        difficultySelection={difficultySelection}
        completionInFlight={completionInFlightRef.current}
        formatDuration={formatDuration}
        onOpenDifficultyModal={openDifficultyModal}
        onDifficultySelectionChange={setDifficultySelection}
        onCloseDifficultyModal={closeDifficultyModal}
        onSaveQuestionDifficulty={saveQuestionDifficulty}
        onSelectDraftAnswer={selectDraftAnswer}
        onSubmitCurrentAnswer={submitCurrentAnswer}
        onGoToPreviousQuestion={goToPreviousQuestion}
        onGoToNextQuestion={goToNextQuestion}
        onRequestFinishConfirmation={requestFinishConfirmation}
        onCloseFinishConfirm={() => setFinishConfirmOpen(false)}
        onCompleteManual={() => completeActiveTest("manual")}
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

function getTimeUrgency(elapsedSeconds: number, timeLimitMinutes: number) {
  if (timeLimitMinutes <= 0) return "normal";
  const totalSeconds = timeLimitMinutes * 60;
  const remainingSeconds = totalSeconds - elapsedSeconds;
  if (remainingSeconds <= 60) return "critical";
  if (remainingSeconds <= 300 || remainingSeconds <= totalSeconds * 0.2) return "warning";
  return "normal";
}

function isSameStringList(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function getOriginalAttemptCounters(activeAttempt: ActiveTestAttempt, definition: TestDefinition) {
  let correct = 0;
  let wrong = 0;
  let answered = 0;

  for (const queueItem of activeAttempt.queue) {
    if (queueItem.retryNumber > 0) continue;
    const answer = activeAttempt.submittedAnswers[queueItem.queueId];
    if (!answer) continue;
    answered += 1;
    if (answer.isCorrect) {
      correct += 1;
    } else {
      wrong += 1;
    }
  }

  return {
    correct,
    wrong,
    answered,
    total: activeAttempt.originalQuestionCount,
    gradeOutOf10: calculateLiveGrade(activeAttempt, definition),
  };
}

function calculateLiveGrade(activeAttempt: ActiveTestAttempt, definition: TestDefinition) {
  const counters = activeAttempt.queue.reduce(
    (result, queueItem) => {
      if (queueItem.retryNumber > 0) return result;
      const answer = activeAttempt.submittedAnswers[queueItem.queueId];
      if (!answer) return result;
      if (answer.isCorrect) {
        result.correct += 1;
      } else {
        result.incorrect += 1;
      }
      return result;
    },
    { correct: 0, incorrect: 0 },
  );

  const finalScore = definition.negativeMarkingEnabled
    ? counters.correct - counters.incorrect * definition.penaltyPerIncorrectAnswer
    : counters.correct;
  const grade =
    activeAttempt.originalQuestionCount > 0
      ? (finalScore / activeAttempt.originalQuestionCount) * 10
      : 0;
  return Math.max(0, Math.min(10, grade));
}

function validateDefinitionForm(form: TestFormState, bankQuestions: CollectionQuestion[]) {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!Number.isInteger(form.questionLimit) || form.questionLimit < 1) {
    errors.questionLimit = "Question limit must be at least 1.";
  }
  if (form.includedCategories.length === 0) {
    errors.includedCategories = "Select at least one category.";
  }
  if (form.timeLimitEnabled && form.timeLimitMinutes < 1) {
    errors.timeLimitMinutes = "Time limit must be at least 1 minute.";
  }
  if (form.negativeMarkingEnabled && form.penaltyPerIncorrectAnswer < 0) {
    errors.penaltyPerIncorrectAnswer = "Penalty cannot be negative.";
  }

  const testDefinition: TestDefinition = {
    id: "temp-id",
    title: form.title,
    questionLimit: form.questionLimit,
    includedCategories: form.includedCategories,
    includedSubcategories: form.includedSubcategories,
    allowUnanswered: form.allowUnanswered,
    timeLimitEnabled: form.timeLimitEnabled,
    negativeMarkingEnabled: form.negativeMarkingEnabled,
    penaltyPerIncorrectAnswer: form.penaltyPerIncorrectAnswer,
    timeLimitMinutes: form.timeLimitEnabled ? form.timeLimitMinutes : 0,
    createdAt: "",
    updatedAt: "",
  };
  const matchingCount = getMatchingQuestions(testDefinition, bankQuestions).length;
  if (matchingCount < 1) errors.includedCategories = "No questions match your filters.";

  const summary = Object.values(errors);
  const limitWarning =
    matchingCount > 0 && form.questionLimit > matchingCount
      ? `Only ${matchingCount} matching questions are currently available.`
      : "";

  return {
    errors: {
      title: errors.title,
      questionLimit: errors.questionLimit,
      includedCategories: errors.includedCategories,
      timeLimitMinutes: errors.timeLimitMinutes,
      penaltyPerIncorrectAnswer: errors.penaltyPerIncorrectAnswer,
    },
    summary,
    matchingCount,
    limitWarning,
    order: [
      "title",
      "questionLimit",
      "includedCategories",
      "timeLimitMinutes",
      "penaltyPerIncorrectAnswer",
    ] as const,
  };
}
