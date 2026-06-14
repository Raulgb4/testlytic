import { useEffect, useRef, useState } from "react";
import { Translator } from "../../../app/types";
import { ActiveTestRecovery } from "../../../services/persistence";
import { DifficultyLevel, QuestionCollection } from "../questionCollectionTypes";
import {
  ActiveTestAttempt,
  CompletedTestAttempt,
  RuntimeAnswer,
  RuntimeQueueItem,
  TestAttempt,
  TestDefinition,
} from "../testTypes";
import { buildRuntimeQuestions, calculateAttemptResult, isExactSetMatch } from "../testUtils";
import { getEffectiveTimeLimitMinutes, getFinishSummary } from "../testRuntimeUtils";

type RatedDifficulty = Exclude<DifficultyLevel, "unrated">;

export function useActiveTestRunner({
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
}: {
  t: Translator;
  collection: QuestionCollection | null;
  definitions: TestDefinition[];
  onGenerateQuestions: (definition: TestDefinition) => Promise<QuestionCollection["questions"]>;
  pendingActiveRecovery: ActiveTestRecovery | null;
  onSaveActiveRecovery: (definition: TestDefinition, activeAttempt: ActiveTestAttempt) => void;
  onClearActiveRecovery: () => void;
  onCompletedAttempt: (
    attempt: CompletedTestAttempt,
    queue: RuntimeQueueItem[],
    submittedAnswers: Record<string, RuntimeAnswer | undefined>,
  ) => void;
  onUpdateQuestionDifficulty: (questionId: string, difficulty: DifficultyLevel) => void;
  setToast: (toast: { message: string; variant: "success" | "error" }) => void;
}) {
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

  const activeRunnerViewProps = activeAttempt
    ? buildActiveRunnerViewProps({
        t,
        activeAttempt,
        activeDefinition,
        finishSummary,
        finishWarning,
        finishConfirmOpen,
        nowMs,
        recoveryBaseTimestamp,
        difficultyModalOpen,
        difficultyTarget,
        difficultySelection,
        completionInFlight: completionInFlightRef.current,
        getQuestionDifficulty,
        getDifficultyLabel,
        openDifficultyModal,
        setDifficultySelection,
        closeDifficultyModal,
        saveQuestionDifficulty,
        selectDraftAnswer,
        submitCurrentAnswer,
        goToPreviousQuestion,
        goToNextQuestion,
        requestFinishConfirmation,
        onCloseFinishConfirm: () => setFinishConfirmOpen(false),
        onCompleteManual: () => completeActiveTest("manual"),
      })
    : null;

  return {
    activeAttempt,
    resultAttempt,
    setResultAttempt,
    runDefinition,
    continueRecoveredTest,
    activeRunnerViewProps,
  };
}

function buildActiveRunnerViewProps({
  t,
  activeAttempt,
  activeDefinition,
  finishSummary,
  finishWarning,
  finishConfirmOpen,
  nowMs,
  recoveryBaseTimestamp,
  difficultyModalOpen,
  difficultyTarget,
  difficultySelection,
  completionInFlight,
  getQuestionDifficulty,
  getDifficultyLabel,
  openDifficultyModal,
  setDifficultySelection,
  closeDifficultyModal,
  saveQuestionDifficulty,
  selectDraftAnswer,
  submitCurrentAnswer,
  goToPreviousQuestion,
  goToNextQuestion,
  requestFinishConfirmation,
  onCloseFinishConfirm,
  onCompleteManual,
}: {
  t: Translator;
  activeAttempt: ActiveTestAttempt;
  activeDefinition: TestDefinition | null;
  finishSummary: ReturnType<typeof getFinishSummary> | null;
  finishWarning: string;
  finishConfirmOpen: boolean;
  nowMs: number;
  recoveryBaseTimestamp: number;
  difficultyModalOpen: boolean;
  difficultyTarget: { questionId: string; questionText: string } | null;
  difficultySelection: RatedDifficulty;
  completionInFlight: boolean;
  getQuestionDifficulty: (questionId: string) => DifficultyLevel;
  getDifficultyLabel: (difficulty: DifficultyLevel) => string;
  openDifficultyModal: (queueItem: RuntimeQueueItem) => void;
  setDifficultySelection: (difficulty: RatedDifficulty) => void;
  closeDifficultyModal: () => void;
  saveQuestionDifficulty: () => void;
  selectDraftAnswer: (queueItem: RuntimeQueueItem, optionId: string) => void;
  submitCurrentAnswer: () => void;
  goToPreviousQuestion: () => void;
  goToNextQuestion: () => void;
  requestFinishConfirmation: () => void;
  onCloseFinishConfirm: () => void;
  onCompleteManual: () => void;
}) {
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

  return {
    activeAttempt,
    activeDefinition,
    currentQueueItem,
    currentAnswer,
    currentDraft,
    hasSubmittedCurrentAnswer,
    showAnswer,
    showNext,
    allowUnanswered,
    originalCounters,
    elapsedSeconds,
    effectiveTimeLimitMinutes,
    timeUrgency,
    visibleQuestionPosition,
    visibleCategory,
    answerExplanation,
    difficultyButtonLabel,
    finishWarning,
    finishConfirmOpen,
    finishSummary,
    difficultyModalOpen,
    difficultyTarget,
    difficultySelection,
    completionInFlight,
    onOpenDifficultyModal: openDifficultyModal,
    onDifficultySelectionChange: setDifficultySelection,
    onCloseDifficultyModal: closeDifficultyModal,
    onSaveQuestionDifficulty: saveQuestionDifficulty,
    onSelectDraftAnswer: selectDraftAnswer,
    onSubmitCurrentAnswer: submitCurrentAnswer,
    onGoToPreviousQuestion: goToPreviousQuestion,
    onGoToNextQuestion: goToNextQuestion,
    onRequestFinishConfirmation: requestFinishConfirmation,
    onCloseFinishConfirm,
    onCompleteManual,
  };
}

function getTimeUrgency(elapsedSeconds: number, timeLimitMinutes: number) {
  if (timeLimitMinutes <= 0) return "normal";
  const totalSeconds = timeLimitMinutes * 60;
  const remainingSeconds = totalSeconds - elapsedSeconds;
  if (remainingSeconds <= 60) return "critical";
  if (remainingSeconds <= 300 || remainingSeconds <= totalSeconds * 0.2) return "warning";
  return "normal";
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
