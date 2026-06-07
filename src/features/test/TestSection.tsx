import {
  FormEvent,
  RefObject,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Toast } from "../../shared/components/Toast";
import { CollectionQuestion, DifficultyLevel, QuestionCollection } from "./questionCollectionTypes";
import {
  ActiveTestAttempt,
  CompletedTestAttempt,
  RuntimeAnswer,
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

type TestFormState = {
  title: string;
  questionLimit: number;
  includedCategories: string[];
  includedSubcategories: string[];
  allowUnanswered: boolean;
  timeLimitEnabled: boolean;
  negativeMarkingEnabled: boolean;
  penaltyPerIncorrectAnswer: number;
  timeLimitMinutes: number;
};

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
  setDefinitions,
  onCompletedAttempt,
  onUpdateQuestionDifficulty,
  onGoToQuestionBank,
}: {
  t: Translator;
  collection: QuestionCollection | null;
  definitions: TestDefinition[];
  setDefinitions: Dispatch<SetStateAction<TestDefinition[]>>;
  onCompletedAttempt: (attempt: CompletedTestAttempt) => void;
  onUpdateQuestionDifficulty: (questionId: string, difficulty: DifficultyLevel) => void;
  onGoToQuestionBank: () => void;
}) {
  const [toast, setToast] = useState<null | { message: string; variant: "success" | "error" }>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
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
  const [resultAttempt, setResultAttempt] = useState<{
    result: TestAttempt;
    definition: TestDefinition;
    reason: "manual" | "timeout";
  } | null>(null);
  const [finishWarning, setFinishWarning] = useState("");
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
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

    setDefinitions((current) => {
      if (editingTestId) {
        return current.map((item) => (item.id === editingTestId ? payload : item));
      }
      return [payload, ...current];
    });
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

  const runDefinition = (definition: TestDefinition) => {
    const runtimeQuestions = buildRuntimeQuestions(definition, bankQuestions);
    if (runtimeQuestions.length === 0) {
      setToast({ message: t("test.noMatchingQuestions"), variant: "error" });
      return;
    }
    const nextAttempt: ActiveTestAttempt = {
      id: `active-${Date.now()}`,
      testId: definition.id,
      startedAt: new Date().toISOString(),
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
    setActiveAttempt(nextAttempt);
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

    setActiveAttempt({
      ...activeAttempt,
      draftSelections: {
        ...activeAttempt.draftSelections,
        [queueItem.queueId]: selectedOptionIds,
      },
    });
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

    setActiveAttempt({
      ...activeAttempt,
      queue: nextQueue,
      submittedAnswers: nextSubmittedAnswers,
    });
    setFinishWarning("");
  };

  const goToPreviousQuestion = () => {
    if (completionInFlightRef.current) return;
    setActiveAttempt((current) => {
      if (!current) return current;
      return {
        ...current,
        currentQueueIndex: Math.max(0, current.currentQueueIndex - 1),
      };
    });
    setFinishWarning("");
  };

  const goToNextQuestion = () => {
    if (completionInFlightRef.current) return;
    setActiveAttempt((current) => {
      if (!current) return current;
      return {
        ...current,
        currentQueueIndex: Math.min(current.queue.length - 1, current.currentQueueIndex + 1),
      };
    });
    setFinishWarning("");
  };

  const activeDefinition = activeAttempt
    ? definitions.find((item) => item.id === activeAttempt.testId) || null
    : null;
  const finishSummary = activeAttempt ? getFinishSummary(activeAttempt) : null;

  const completeActiveTest = (reason: "manual" | "timeout") => {
    if (!activeAttempt || !activeDefinition || completionInFlightRef.current) return;
    completionInFlightRef.current = true;
    const result = calculateAttemptResult(activeAttempt, activeDefinition);
    setFinishConfirmOpen(false);
    setFinishWarning("");
    setDifficultyModalOpen(false);
    setDifficultyTarget(null);
    setResultAttempt({ result, definition: activeDefinition, reason });
    onCompletedAttempt(result);
    setActiveAttempt(null);
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
    const startedAtMs = new Date(activeAttempt.startedAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
    const remainingSeconds = getEffectiveTimeLimitMinutes(activeDefinition) * 60 - elapsedSeconds;
    if (remainingSeconds > 0) return;
    completeActiveTest("timeout");
  }, [activeAttempt, activeDefinition, nowMs]);

  if (!collection) {
    return (
      <div className="test-empty-state-wrap">
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
    const elapsedSeconds = Math.max(
      0,
      Math.floor((nowMs - new Date(activeAttempt.startedAt).getTime()) / 1000),
    );
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
      <div className="test-runner-full">
        <section
          className={`test-exam-header time-${timeUrgency}`}
          aria-label={t("test.activeTitle")}
        >
          <div className="test-exam-header-main">
            <div className="test-exam-title-block">
              <h3>{activeDefinition?.title || t("test.activeTitle")}</h3>
              <p>{visibleCategory}</p>
            </div>
            <div
              className="test-exam-grade"
              aria-label={`${t("test.statusGrade")} ${originalCounters.gradeOutOf10.toFixed(1)} / 10`}
            >
              <span>{t("test.statusGrade")}</span>
              <strong>{originalCounters.gradeOutOf10.toFixed(1)} / 10</strong>
            </div>
          </div>

          <div className="test-exam-stats">
            <MetricLine
              label={t("test.statusQuestion")}
              value={`${visibleQuestionPosition}/${activeAttempt.originalQuestionCount}`}
            />
            <MetricLine
              label={t("test.statusAnswered")}
              value={`${originalCounters.answered}/${originalCounters.total}`}
            />
            <MetricLine label={t("test.statusCorrect")} value={String(originalCounters.correct)} />
            <MetricLine label={t("test.statusWrong")} value={String(originalCounters.wrong)} />
            <MetricLine label={t("test.statusElapsed")} value={formatDuration(elapsedSeconds)} />
            <MetricLine
              label={t("test.statusLimit")}
              value={
                activeDefinition && effectiveTimeLimitMinutes > 0
                  ? t("test.limitMinutes", { minutes: effectiveTimeLimitMinutes })
                  : t("test.noTimeLimit")
              }
              className={timeUrgency === "normal" ? undefined : "time-metric"}
            />
          </div>
        </section>

        <Card
          title={t("test.questionTitle", { number: activeAttempt.currentQueueIndex + 1 })}
          className="test-runner-card"
        >
          <div className="runner-card-toolbar">
            <button
              type="button"
              className="runner-difficulty-button"
              onClick={() => openDifficultyModal(currentQueueItem)}
              aria-label={difficultyButtonLabel}
              title={difficultyButtonLabel}
            >
              <span aria-hidden="true">i</span>
            </button>
          </div>
          <p className="runner-question">{currentQuestion.question}</p>
          {currentQuestion.auxiliaryInformation ? (
            <p className="runner-note">{currentQuestion.auxiliaryInformation}</p>
          ) : null}
          <div className="runner-options" role="group" aria-label={t("test.answerOptions")}>
            {currentQuestion.options.map((option, optionIndex) => {
              const selected =
                currentDraft.includes(option.id) ||
                currentAnswer?.selectedOptionIds.includes(option.id) ||
                false;
              const hasAnswer = hasSubmittedCurrentAnswer;
              const isCorrectOption = currentQuestion.correctOptions.includes(option.id);
              let className = "runner-option";
              if (selected) className += " selected";
              if (hasAnswer) {
                if (isCorrectOption) className += " correct";
                if (selected && !isCorrectOption) className += " incorrect";
              }
              return (
                <button
                  key={option.id}
                  type="button"
                  className={className}
                  onClick={() => selectDraftAnswer(currentQueueItem, option.id)}
                  disabled={completionInFlightRef.current}
                >
                  <span className="option-key">{getVisibleOptionLabel(optionIndex)}</span>
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>

          {hasSubmittedCurrentAnswer && answerExplanation ? (
            <div className="runner-explanation" aria-live="polite">
              <p className="runner-explanation-title">{t("test.explanation")}</p>
              <p className="runner-explanation-body">{answerExplanation}</p>
            </div>
          ) : null}

          <div className="test-runner-footer">
            <div className="test-runner-footer-main">
              {activeAttempt.currentQueueIndex > 0 ? (
                <Button variant="secondary" onClick={goToPreviousQuestion}>
                  {t("test.previous")}
                </Button>
              ) : null}
              {showAnswer ? (
                <Button onClick={submitCurrentAnswer}>{t("test.answer")}</Button>
              ) : null}
              {showNext ? (
                <Button variant="secondary" onClick={goToNextQuestion}>
                  {t("test.next")}
                </Button>
              ) : null}
            </div>
            <div className="test-runner-finish-action">
              <button type="button" className="btn btn-danger" onClick={requestFinishConfirmation}>
                {t("test.finish")}
              </button>
            </div>
          </div>
        </Card>
        {finishWarning ? (
          <p className="field-error runner-finish-warning">{finishWarning}</p>
        ) : null}
        {finishConfirmOpen && finishSummary ? (
          <div className="settings-modal-backdrop" role="presentation">
            <div className="settings-modal finish-confirm-modal" role="dialog" aria-modal="true">
              <h3>{t("test.finishConfirmTitle")}</h3>
              <p>{t("test.finishConfirmBody")}</p>
              <div className="finish-confirm-summary">
                <MetricLine
                  label={t("test.statusAnswered")}
                  value={String(finishSummary.answered)}
                />
                <MetricLine
                  label={t("test.kpiUnanswered")}
                  value={String(finishSummary.unanswered)}
                />
                <MetricLine label={t("test.statusCorrect")} value={String(finishSummary.correct)} />
                <MetricLine label={t("test.statusWrong")} value={String(finishSummary.incorrect)} />
              </div>
              {!allowUnanswered && finishSummary.unanswered > 0 ? (
                <p className="field-error finish-confirm-blocked">
                  {t("test.finishConfirmBlocked", { count: finishSummary.unanswered })}
                </p>
              ) : null}
              <div className="settings-modal-actions">
                <Button variant="secondary" onClick={() => setFinishConfirmOpen(false)}>
                  {t("test.cancel")}
                </Button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => completeActiveTest("manual")}
                  disabled={!allowUnanswered && finishSummary.unanswered > 0}
                >
                  {t("test.finishConfirmAction")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {difficultyModalOpen && difficultyTarget ? (
          <div className="settings-modal-backdrop" role="presentation">
            <div
              className="settings-modal difficulty-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="difficulty-modal-title"
            >
              <h3 id="difficulty-modal-title">{t("test.difficultyModalTitle")}</h3>
              <p>{t("test.difficultyModalBody")}</p>
              <div className="difficulty-modal-question">{difficultyTarget.questionText}</div>

              <fieldset className={`difficulty-selector difficulty-${difficultySelection}`}>
                <legend>{t("test.rateDifficulty")}</legend>
                <span className="difficulty-selector-thumb" aria-hidden="true" />
                {DIFFICULTY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={
                      difficultySelection === option.value
                        ? "difficulty-selector-option selected"
                        : "difficulty-selector-option"
                    }
                  >
                    <input
                      type="radio"
                      name="question-difficulty"
                      value={option.value}
                      checked={difficultySelection === option.value}
                      onChange={() => setDifficultySelection(option.value)}
                    />
                    <span>{t(option.labelKey)}</span>
                  </label>
                ))}
              </fieldset>

              <div className="settings-modal-actions difficulty-modal-actions">
                <Button variant="secondary" onClick={closeDifficultyModal}>
                  {t("test.cancel")}
                </Button>
                <Button onClick={saveQuestionDifficulty}>{t("test.saveDifficulty")}</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (resultAttempt) {
    const { result, definition, reason } = resultAttempt;
    return (
      <div className="view-grid results-view">
        <Card
          title={t("test.finalGrade")}
          subtitle={definition.title}
          className="results-hero-card"
        >
          {reason === "timeout" ? (
            <p className="results-timeout-notice">{t("test.timeUp")}</p>
          ) : null}
          <p className="results-grade">{result.gradeOutOf10.toFixed(1)} / 10</p>
          <div className="results-meta-line">
            <span>
              {t("test.completedFriendly", { value: formatDateTime(result.completedAt) })}
            </span>
            <span>
              {t("test.kpiDuration")}: {formatDuration(result.durationSeconds)}
            </span>
          </div>
        </Card>

        <Card
          title={t("test.resultsTitle")}
          subtitle={t("test.resultsSubtitle")}
          className="results-summary-card"
        >
          <div className="kpi-grid results-kpi-grid">
            <MetricLine
              label={t("test.finalScoreFriendly")}
              value={`${result.finalScore.toFixed(2)}`}
            />
            <MetricLine
              label={t("test.kpiAccuracy")}
              value={`${result.accuracyPercentage.toFixed(2)}%`}
            />
            <MetricLine label={t("test.kpiCorrect")} value={String(result.correctAnswers)} />
            <MetricLine label={t("test.kpiIncorrect")} value={String(result.incorrectAnswers)} />
            <MetricLine
              label={t("test.kpiUnanswered")}
              value={String(result.unansweredQuestions)}
            />
            <MetricLine
              label={t("test.kpiDuration")}
              value={formatDuration(result.durationSeconds)}
            />
          </div>
          <div className="retry-summary">
            <MetricLine label={t("test.retryAttempts")} value={String(result.retryAttempts)} />
            <MetricLine label={t("test.retryCorrect")} value={String(result.retryCorrectAnswers)} />
            <MetricLine label={t("test.retryWrong")} value={String(result.retryIncorrectAnswers)} />
          </div>
          <p className="placeholder-note">{t("test.retryLearningNote")}</p>
          <div className="results-return-action">
            <Button onClick={() => setResultAttempt(null)}>{t("test.returnToHome")}</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="view-grid test-home-grid">
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
          <div className="saved-tests-section">
            {definitions.length === 0 ? (
              <p className="placeholder-note">{t("test.noSavedTests")}</p>
            ) : null}
            <div className="saved-tests-list">
              {definitions.map((definition) => {
                const matchingCount = getMatchingQuestions(definition, collection.questions).length;
                return (
                  <article key={definition.id} className="saved-test-item">
                    <div>
                      <p className="saved-test-title">{definition.title}</p>
                      <p className="saved-test-meta">
                        {t("test.savedTestMeta", {
                          questions: definition.questionLimit,
                          categories: definition.includedCategories.length,
                          time:
                            getEffectiveTimeLimitMinutes(definition) > 0
                              ? t("test.savedTestTimeLimit", {
                                  minutes: getEffectiveTimeLimitMinutes(definition),
                                })
                              : t("test.savedTestNoTimeLimit"),
                          negative: definition.negativeMarkingEnabled
                            ? t("test.savedTestNegativeOn")
                            : t("test.savedTestNegativeOff"),
                          matching: matchingCount,
                        })}
                      </p>
                    </div>
                    <div className="saved-test-actions">
                      <Button onClick={() => runDefinition(definition)}>{t("test.run")}</Button>
                      <Button variant="secondary" onClick={() => openEdit(definition)}>
                        {t("test.edit")}
                      </Button>
                      <Button variant="secondary" onClick={() => setDeleteTarget(definition)}>
                        {t("test.delete")}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {formOpen ? (
        <div className="settings-modal-backdrop" role="presentation">
          <div
            className="settings-modal test-definition-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-definition-title"
          >
            <h3 id="test-definition-title">
              {editingTestId ? t("test.editTest") : t("test.createTest")}
            </h3>
            <form className="test-definition-form" onSubmit={saveDefinition} noValidate>
              <div className="test-definition-body">
                <section className="test-form-section">
                  <h4>{t("test.sectionBasics")}</h4>
                  <label className="field">
                    <span>{t("test.modalTitle")}</span>
                    <input
                      ref={titleInputRef}
                      className="input"
                      value={formState.title}
                      onChange={(event) =>
                        setFormState({ ...formState, title: event.target.value })
                      }
                      aria-invalid={showErrors && Boolean(formValidation.errors.title)}
                    />
                    {showErrors && formValidation.errors.title ? (
                      <small className="field-error">{formValidation.errors.title}</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>{t("test.questionLimit")}</span>
                    <input
                      ref={questionLimitInputRef}
                      className="input"
                      type="number"
                      min={1}
                      value={formState.questionLimit}
                      onChange={(event) =>
                        setFormState({
                          ...formState,
                          questionLimit: Number(event.target.value || 1),
                        })
                      }
                      aria-invalid={showErrors && Boolean(formValidation.errors.questionLimit)}
                    />
                    {showErrors && formValidation.errors.questionLimit ? (
                      <small className="field-error">{formValidation.errors.questionLimit}</small>
                    ) : null}
                    {formValidation.matchingCount > 0 ? (
                      <small className="field-hint">
                        {t("test.matchingCount", { count: formValidation.matchingCount })}
                      </small>
                    ) : null}
                    {formValidation.limitWarning ? (
                      <small className="field-warning">{formValidation.limitWarning}</small>
                    ) : null}
                  </label>
                </section>

                <section className="test-form-section">
                  <h4>{t("test.sectionFilters")}</h4>
                  <SearchableMultiSelect
                    label={t("test.includedCategories")}
                    placeholder={t("test.searchCategories")}
                    options={categoryOptions}
                    selected={formState.includedCategories}
                    onChange={updateIncludedCategories}
                    triggerRef={categoriesTriggerRef}
                    error={showErrors ? formValidation.errors.includedCategories : undefined}
                    selectedCountLabel={t("test.selectedCount", {
                      count: formState.includedCategories.length,
                    })}
                    clearLabel={t("test.clearAll")}
                    selectAllLabel={t("test.selectAllCategories")}
                    onSelectAll={() => updateIncludedCategories(categoryOptions)}
                    closeLabel={t("test.close")}
                  />

                  <SearchableMultiSelect
                    label={t("test.includedSubcategoriesOptional")}
                    placeholder={t("test.searchSubcategories")}
                    options={subcategoryOptions}
                    selected={formState.includedSubcategories}
                    onChange={(next) => setFormState({ ...formState, includedSubcategories: next })}
                    disabled={formState.includedCategories.length === 0}
                    disabledText={t("test.selectCategoryFirst")}
                    selectedCountLabel={t("test.selectedCount", {
                      count: formState.includedSubcategories.length,
                    })}
                    clearLabel={t("test.clearAll")}
                    selectAllLabel={t("test.selectAllCategories")}
                    onSelectAll={() =>
                      setFormState({ ...formState, includedSubcategories: subcategoryOptions })
                    }
                    closeLabel={t("test.close")}
                  />
                </section>

                <section className="test-form-section">
                  <h4>{t("test.sectionTimingScoring")}</h4>
                  <label className="field-inline">
                    <input
                      type="checkbox"
                      checked={formState.allowUnanswered}
                      onChange={(event) =>
                        setFormState({ ...formState, allowUnanswered: event.target.checked })
                      }
                    />
                    <span>{t("test.allowUnanswered")}</span>
                  </label>

                  <label className="field-inline">
                    <input
                      type="checkbox"
                      checked={formState.timeLimitEnabled}
                      onChange={(event) =>
                        setFormState({ ...formState, timeLimitEnabled: event.target.checked })
                      }
                    />
                    <span>{t("test.enableTimeLimit")}</span>
                  </label>

                  <div
                    className={
                      formState.timeLimitEnabled ? "penalty-reveal show" : "penalty-reveal"
                    }
                  >
                    <label className="field">
                      <span>{t("test.timeLimit")}</span>
                      <input
                        ref={timeLimitInputRef}
                        className="input"
                        type="number"
                        min={1}
                        value={formState.timeLimitMinutes}
                        onChange={(event) =>
                          setFormState({
                            ...formState,
                            timeLimitMinutes: Number(event.target.value || 0),
                          })
                        }
                        aria-invalid={showErrors && Boolean(formValidation.errors.timeLimitMinutes)}
                      />
                      {showErrors && formValidation.errors.timeLimitMinutes ? (
                        <small className="field-error">
                          {formValidation.errors.timeLimitMinutes}
                        </small>
                      ) : null}
                    </label>
                  </div>

                  <label className="field-inline">
                    <input
                      type="checkbox"
                      checked={formState.negativeMarkingEnabled}
                      onChange={(event) =>
                        setFormState({ ...formState, negativeMarkingEnabled: event.target.checked })
                      }
                    />
                    <span>{t("test.negativeMarking")}</span>
                  </label>

                  <div
                    className={
                      formState.negativeMarkingEnabled ? "penalty-reveal show" : "penalty-reveal"
                    }
                  >
                    <label className="field">
                      <span>{t("test.penaltyPerIncorrectAnswer")}</span>
                      <input
                        ref={penaltyInputRef}
                        className="input"
                        type="number"
                        min={0}
                        step={0.05}
                        value={formState.penaltyPerIncorrectAnswer}
                        onChange={(event) =>
                          setFormState({
                            ...formState,
                            penaltyPerIncorrectAnswer: Number(event.target.value || 0),
                          })
                        }
                        aria-invalid={
                          showErrors && Boolean(formValidation.errors.penaltyPerIncorrectAnswer)
                        }
                      />
                      {showErrors && formValidation.errors.penaltyPerIncorrectAnswer ? (
                        <small className="field-error">
                          {formValidation.errors.penaltyPerIncorrectAnswer}
                        </small>
                      ) : null}
                    </label>
                  </div>
                </section>
              </div>

              {showErrors && formValidation.summary.length > 0 ? (
                <div className="form-error-summary" role="alert" aria-live="polite">
                  <p>{t("test.fixFieldsBeforeSave", { count: formValidation.summary.length })}</p>
                </div>
              ) : null}

              <footer className="test-definition-footer">
                <button
                  type="button"
                  className="btn btn-secondary modal-action-btn"
                  onClick={() => setFormOpen(false)}
                >
                  {t("test.cancel")}
                </button>
                <button type="submit" className="btn btn-primary modal-action-btn">
                  {t("test.saveTest")}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal" role="dialog" aria-modal="true">
            <h3>{t("test.deleteTestConfirmTitle")}</h3>
            <p>{t("test.deleteTestConfirmBody", { title: deleteTarget.title })}</p>
            <div className="settings-modal-actions">
              <Button
                onClick={() => {
                  setDefinitions((current) =>
                    current.filter((item) => item.id !== deleteTarget.id),
                  );
                  setDeleteTarget(null);
                }}
              >
                {t("settings.confirm")}
              </Button>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                {t("test.cancel")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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

function MetricLine({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className ? `metric-inline ${className}` : "metric-inline"}>
      <span className="metric-inline-label">{label}</span>
      <span className="metric-inline-value">{value}</span>
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

function getVisibleOptionLabel(index: number) {
  return String.fromCharCode(65 + index);
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

function SearchableMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  selectedCountLabel,
  clearLabel,
  selectAllLabel,
  onSelectAll,
  closeLabel,
  disabled,
  disabledText,
  error,
  triggerRef,
}: {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  selectedCountLabel: string;
  clearLabel: string;
  selectAllLabel?: string;
  onSelectAll?: () => void;
  closeLabel: string;
  disabled?: boolean;
  disabledText?: string;
  error?: string;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedValues = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(
    () => options.filter((item) => item.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  const toggleSelection = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <div className="field multi-select-field">
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="input multi-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {selected.length > 0 ? selectedCountLabel : placeholder}
      </button>

      {open && !disabled ? (
        <div className="multi-select-panel">
          <input
            className="input multi-select-search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="multi-select-options">
            {filtered.map((option) => (
              <label key={option} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={selectedValues.has(option)}
                  onChange={() => toggleSelection(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <div className="multi-select-actions">
            <div className="multi-select-bulk-actions">
              <button type="button" className="btn btn-secondary" onClick={() => onChange([])}>
                {clearLabel}
              </button>
              {selectAllLabel && onSelectAll ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onSelectAll}
                  disabled={options.length === 0}
                >
                  {selectAllLabel}
                </button>
              ) : null}
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              {closeLabel}
            </button>
          </div>
        </div>
      ) : null}

      {disabled && disabledText ? <small className="field-hint">{disabledText}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}
