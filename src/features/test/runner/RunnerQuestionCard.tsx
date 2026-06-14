import { Translator } from "../../../app/types";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { RuntimeAnswer, RuntimeQueueItem } from "../testTypes";
import { getVisibleOptionLabel } from "./runnerViewUtils";

export function RunnerQuestionCard({
  t,
  currentQueueIndex,
  currentQueueItem,
  currentAnswer,
  currentDraft,
  hasSubmittedCurrentAnswer,
  answerExplanation,
  showAnswer,
  showNext,
  completionInFlight,
  difficultyButtonLabel,
  onOpenDifficultyModal,
  onSelectDraftAnswer,
  onSubmitCurrentAnswer,
  onGoToPreviousQuestion,
  onGoToNextQuestion,
  onRequestFinishConfirmation,
}: {
  t: Translator;
  currentQueueIndex: number;
  currentQueueItem: RuntimeQueueItem;
  currentAnswer: RuntimeAnswer | undefined;
  currentDraft: string[];
  hasSubmittedCurrentAnswer: boolean;
  answerExplanation: string;
  showAnswer: boolean;
  showNext: boolean;
  completionInFlight: boolean;
  difficultyButtonLabel: string;
  onOpenDifficultyModal: (queueItem: RuntimeQueueItem) => void;
  onSelectDraftAnswer: (queueItem: RuntimeQueueItem, optionId: string) => void;
  onSubmitCurrentAnswer: () => void;
  onGoToPreviousQuestion: () => void;
  onGoToNextQuestion: () => void;
  onRequestFinishConfirmation: () => void;
}) {
  const currentQuestion = currentQueueItem.question;

  return (
    <Card
      title={t("test.questionTitle", { number: currentQueueIndex + 1 })}
      className="test-runner-card"
    >
      <div className="runner-card-toolbar">
        <button
          type="button"
          className="runner-difficulty-button"
          onClick={() => onOpenDifficultyModal(currentQueueItem)}
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
              onClick={() => onSelectDraftAnswer(currentQueueItem, option.id)}
              disabled={completionInFlight}
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
          {currentQueueIndex > 0 ? (
            <Button variant="secondary" onClick={onGoToPreviousQuestion}>
              {t("test.previous")}
            </Button>
          ) : null}
          {showAnswer ? <Button onClick={onSubmitCurrentAnswer}>{t("test.answer")}</Button> : null}
          {showNext ? (
            <Button variant="secondary" onClick={onGoToNextQuestion}>
              {t("test.next")}
            </Button>
          ) : null}
        </div>
        <div className="test-runner-finish-action">
          <button type="button" className="btn btn-danger" onClick={onRequestFinishConfirmation}>
            {t("test.finish")}
          </button>
        </div>
      </div>
    </Card>
  );
}
