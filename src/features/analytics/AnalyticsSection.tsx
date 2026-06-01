import { Translator } from "../../app/types";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { CompletedTestAttempt } from "../test/testTypes";
import {
  calculateAnalyticsSummary,
  calculateCategoryPerformance,
  calculateGradeDistribution,
  calculateRecentTrend,
} from "./analyticsUtils";

export function AnalyticsSection({
  t,
  completedAttempts,
}: {
  t: Translator;
  completedAttempts: CompletedTestAttempt[];
}) {
  const summary = calculateAnalyticsSummary(completedAttempts);
  const trend = calculateRecentTrend(completedAttempts);
  const distribution = calculateGradeDistribution(completedAttempts);
  const categoryPerformance = calculateCategoryPerformance(completedAttempts);

  if (completedAttempts.length === 0) {
    return (
      <div className="view-grid analytics-view">
        <Card title={t("analytics.title")} subtitle={t("analytics.emptySubtitle")} className="analytics-empty-card">
          <p className="placeholder-note">{t("analytics.emptyBody")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="view-grid analytics-view">
      <Card title={t("analytics.title")} subtitle={t("analytics.subtitle")}>
        <div className="kpi-grid analytics-kpi-grid">
          <MetricCard item={{ label: t("analytics.completedTests"), value: String(summary.testsCompleted), change: t("analytics.localOnly") }} />
          <MetricCard item={{ label: t("analytics.averageGrade"), value: `${summary.averageGrade.toFixed(1)} / 10`, change: t("analytics.bestGrade", { value: summary.bestGrade.toFixed(1) }) }} />
          <MetricCard item={{ label: t("analytics.worstGrade"), value: `${summary.worstGrade.toFixed(1)} / 10`, change: t("analytics.gradeRange") }} />
          <MetricCard item={{ label: t("analytics.accuracy"), value: `${summary.accuracy.toFixed(1)}%`, change: t("analytics.originalQuestions") }} />
          <MetricCard item={{ label: t("analytics.totalQuestionsAnswered"), value: String(summary.totalQuestionsAnswered), change: t("analytics.submittedOriginals") }} />
          <MetricCard item={{ label: t("analytics.totalStudyTime"), value: formatDuration(summary.totalStudyTime), change: t("analytics.localOnly") }} />
          <MetricCard item={{ label: t("analytics.correctAnswers"), value: String(summary.correctAnswers), change: t("analytics.originalQuestions") }} />
          <MetricCard item={{ label: t("analytics.incorrectAnswers"), value: String(summary.incorrectAnswers), change: t("analytics.originalQuestions") }} />
          <MetricCard item={{ label: t("analytics.mostUsedCategory"), value: summary.mostUsedCategory || t("analytics.noDataTopic"), change: t("analytics.byOriginalQuestions") }} />
          <MetricCard item={{ label: t("analytics.strongestCategory"), value: summary.strongestCategory || t("analytics.noDataTopic"), change: t("analytics.byAccuracy") }} />
          <MetricCard item={{ label: t("analytics.weakestCategory"), value: summary.weakestCategory || t("analytics.noDataTopic"), change: t("analytics.byAccuracy") }} />
        </div>
      </Card>

      <Card title={t("analytics.trendTitle")} subtitle={t("analytics.trendSubtitle")}>
        <div className="analytics-bars">
          {trend.map((item) => (
            <div key={`${item.label}-${item.title}`} className="analytics-bar-row">
              <span>{item.title}</span>
              <div className="analytics-bar-track"><span style={{ width: `${item.grade * 10}%` }} /></div>
              <strong>{item.grade.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("analytics.gradeDistribution")} subtitle={t("analytics.gradeDistributionSubtitle")}>
        <div className="analytics-bars">
          {distribution.map((bucket) => (
            <div key={bucket.label} className="analytics-bar-row">
              <span>{bucket.label}</span>
              <div className="analytics-bar-track"><span style={{ width: `${Math.min(100, bucket.count * 18)}%` }} /></div>
              <strong>{bucket.count}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("analytics.categoryComparison")} subtitle={t("analytics.categoryComparisonSubtitle")}>
        <div className="analytics-category-list">
          {categoryPerformance.map((category) => (
            <article key={category.category} className="analytics-category-row">
              <div>
                <strong>{category.category}</strong>
                <p>{t("analytics.categoryResult", { correct: category.correct, total: category.total })}</p>
              </div>
              <span>{category.accuracyPercentage.toFixed(1)}%</span>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
