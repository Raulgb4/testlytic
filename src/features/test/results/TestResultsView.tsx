import { Translator } from "../../../app/types";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { TestAttempt, TestDefinition } from "../testTypes";
import { MetricLine } from "../components/MetricLine";

export function TestResultsView({
  t,
  result,
  definition,
  reason,
  onReturnToHome,
  formatDateTime,
  formatDuration,
}: {
  t: Translator;
  result: TestAttempt;
  definition: TestDefinition;
  reason: "manual" | "timeout";
  onReturnToHome: () => void;
  formatDateTime: (iso: string) => string;
  formatDuration: (seconds: number) => string;
}) {
  return (
    <div className="view-grid results-view">
      <Card title={t("test.finalGrade")} subtitle={definition.title} className="results-hero-card">
        {reason === "timeout" ? <p className="results-timeout-notice">{t("test.timeUp")}</p> : null}
        <p className="results-grade">{result.gradeOutOf10.toFixed(1)} / 10</p>
        <div className="results-meta-line">
          <span>{t("test.completedFriendly", { value: formatDateTime(result.completedAt) })}</span>
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
          <MetricLine label={t("test.kpiUnanswered")} value={String(result.unansweredQuestions)} />
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
          <Button onClick={onReturnToHome}>{t("test.returnToHome")}</Button>
        </div>
      </Card>
    </div>
  );
}
