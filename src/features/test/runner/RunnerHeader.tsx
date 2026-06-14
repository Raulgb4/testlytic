import { Translator } from "../../../app/types";
import { MetricLine } from "../components/MetricLine";
import { TestDefinition } from "../testTypes";

export function RunnerHeader({
  t,
  activeDefinition,
  visibleCategory,
  originalCounters,
  visibleQuestionPosition,
  originalQuestionCount,
  elapsedSeconds,
  effectiveTimeLimitMinutes,
  timeUrgency,
  formatDuration,
}: {
  t: Translator;
  activeDefinition: TestDefinition | null;
  visibleCategory: string;
  originalCounters: {
    correct: number;
    wrong: number;
    answered: number;
    total: number;
    gradeOutOf10: number;
  };
  visibleQuestionPosition: number;
  originalQuestionCount: number;
  elapsedSeconds: number;
  effectiveTimeLimitMinutes: number;
  timeUrgency: string;
  formatDuration: (seconds: number) => string;
}) {
  return (
    <section className={`test-exam-header time-${timeUrgency}`} aria-label={t("test.activeTitle")}>
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
          value={`${visibleQuestionPosition}/${originalQuestionCount}`}
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
  );
}
