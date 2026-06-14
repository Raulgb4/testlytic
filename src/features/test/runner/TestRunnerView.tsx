import { Translator } from "../../../app/types";
import { DifficultyLevel } from "../questionCollectionTypes";
import { ActiveTestAttempt, RuntimeAnswer, RuntimeQueueItem, TestDefinition } from "../testTypes";
import { DifficultyModal } from "./DifficultyModal";
import { FinishConfirmModal } from "./FinishConfirmModal";
import { RunnerHeader } from "./RunnerHeader";
import { RunnerQuestionCard } from "./RunnerQuestionCard";

type RatedDifficulty = Exclude<DifficultyLevel, "unrated">;

export function TestRunnerView({
  t,
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
  difficultyOptions,
  difficultySelection,
  completionInFlight,
  formatDuration,
  onOpenDifficultyModal,
  onDifficultySelectionChange,
  onCloseDifficultyModal,
  onSaveQuestionDifficulty,
  onSelectDraftAnswer,
  onSubmitCurrentAnswer,
  onGoToPreviousQuestion,
  onGoToNextQuestion,
  onRequestFinishConfirmation,
  onCloseFinishConfirm,
  onCompleteManual,
}: {
  t: Translator;
  activeAttempt: ActiveTestAttempt;
  activeDefinition: TestDefinition | null;
  currentQueueItem: RuntimeQueueItem;
  currentAnswer: RuntimeAnswer | undefined;
  currentDraft: string[];
  hasSubmittedCurrentAnswer: boolean;
  showAnswer: boolean;
  showNext: boolean;
  allowUnanswered: boolean;
  originalCounters: {
    correct: number;
    wrong: number;
    answered: number;
    total: number;
    gradeOutOf10: number;
  };
  elapsedSeconds: number;
  effectiveTimeLimitMinutes: number;
  timeUrgency: string;
  visibleQuestionPosition: number;
  visibleCategory: string;
  answerExplanation: string;
  difficultyButtonLabel: string;
  finishWarning: string;
  finishConfirmOpen: boolean;
  finishSummary: {
    answered: number;
    unanswered: number;
    correct: number;
    incorrect: number;
  } | null;
  difficultyModalOpen: boolean;
  difficultyTarget: { questionId: string; questionText: string } | null;
  difficultyOptions: Array<{ value: RatedDifficulty; labelKey: string }>;
  difficultySelection: RatedDifficulty;
  completionInFlight: boolean;
  formatDuration: (seconds: number) => string;
  onOpenDifficultyModal: (queueItem: RuntimeQueueItem) => void;
  onDifficultySelectionChange: (difficulty: RatedDifficulty) => void;
  onCloseDifficultyModal: () => void;
  onSaveQuestionDifficulty: () => void;
  onSelectDraftAnswer: (queueItem: RuntimeQueueItem, optionId: string) => void;
  onSubmitCurrentAnswer: () => void;
  onGoToPreviousQuestion: () => void;
  onGoToNextQuestion: () => void;
  onRequestFinishConfirmation: () => void;
  onCloseFinishConfirm: () => void;
  onCompleteManual: () => void;
}) {
  return (
    <div className="test-runner-full">
      <RunnerHeader
        t={t}
        activeDefinition={activeDefinition}
        visibleCategory={visibleCategory}
        originalCounters={originalCounters}
        visibleQuestionPosition={visibleQuestionPosition}
        originalQuestionCount={activeAttempt.originalQuestionCount}
        elapsedSeconds={elapsedSeconds}
        effectiveTimeLimitMinutes={effectiveTimeLimitMinutes}
        timeUrgency={timeUrgency}
        formatDuration={formatDuration}
      />

      <RunnerQuestionCard
        t={t}
        currentQueueIndex={activeAttempt.currentQueueIndex}
        currentQueueItem={currentQueueItem}
        currentAnswer={currentAnswer}
        currentDraft={currentDraft}
        hasSubmittedCurrentAnswer={hasSubmittedCurrentAnswer}
        answerExplanation={answerExplanation}
        showAnswer={showAnswer}
        showNext={showNext}
        completionInFlight={completionInFlight}
        difficultyButtonLabel={difficultyButtonLabel}
        onOpenDifficultyModal={onOpenDifficultyModal}
        onSelectDraftAnswer={onSelectDraftAnswer}
        onSubmitCurrentAnswer={onSubmitCurrentAnswer}
        onGoToPreviousQuestion={onGoToPreviousQuestion}
        onGoToNextQuestion={onGoToNextQuestion}
        onRequestFinishConfirmation={onRequestFinishConfirmation}
      />
      {finishWarning ? <p className="field-error runner-finish-warning">{finishWarning}</p> : null}
      {finishConfirmOpen && finishSummary ? (
        <FinishConfirmModal
          t={t}
          finishSummary={finishSummary}
          allowUnanswered={allowUnanswered}
          onCancel={onCloseFinishConfirm}
          onConfirm={onCompleteManual}
        />
      ) : null}

      {difficultyModalOpen && difficultyTarget ? (
        <DifficultyModal
          t={t}
          questionText={difficultyTarget.questionText}
          difficultyOptions={difficultyOptions}
          difficultySelection={difficultySelection}
          onDifficultySelectionChange={onDifficultySelectionChange}
          onClose={onCloseDifficultyModal}
          onSave={onSaveQuestionDifficulty}
        />
      ) : null}
    </div>
  );
}
