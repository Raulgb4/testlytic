import { useMemo, useState } from "react";
import { Translator } from "../../app/types";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { QuestionCollection } from "../test/questionCollectionTypes";
import { CompletedTestAttempt } from "../test/testTypes";
import {
  buildBankInsights,
  buildUserInsights,
  calculateAnalyticsSummary,
  calculateAnswerOutcomeDistribution,
  calculateBankSummary,
  calculateCategoryPerformance,
  calculateDifficultyDistribution,
  calculateExposureDistribution,
  calculateGradeDistribution,
  calculateQuestionDistribution,
  calculateRecentTrend,
  calculateSeenDistribution,
  calculateSmartSelectionHealth,
  calculateTrendDelta,
  getMostFailedQuestions,
  getQuestionExposureRankings,
  getStrongestCategories,
  getWeakestCategories,
  truncate,
  BankInsight,
  DistributionItem,
  RankingItem,
  UserInsight,
} from "./analyticsUtils";
import "./analytics.css";

type AnalyticsTab = "user" | "bank";
type DateRange = "all" | "30" | "90";

type AnalyticsFilters = {
  category: string;
  subcategory: string;
  dateRange: DateRange;
};

const INITIAL_FILTERS: AnalyticsFilters = {
  category: "all",
  subcategory: "all",
  dateRange: "all",
};

export function AnalyticsSection({
  t,
  completedAttempts,
  collection,
}: {
  t: Translator;
  completedAttempts: CompletedTestAttempt[];
  collection: QuestionCollection | null;
}) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("user");
  const [filters, setFilters] = useState<AnalyticsFilters>(INITIAL_FILTERS);
  const categories = useMemo(
    () =>
      Array.from(
        new Set((collection?.questions ?? []).map((question) => question.questionCategory)),
      ).sort(),
    [collection],
  );
  const subcategories = useMemo(
    () =>
      Array.from(
        new Set(
          (collection?.questions ?? [])
            .filter(
              (question) =>
                filters.category === "all" || question.questionCategory === filters.category,
            )
            .map((question) => question.questionSubcategory)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [collection, filters.category],
  );
  const filteredAttempts = useMemo(
    () => filterAttempts(completedAttempts, filters),
    [completedAttempts, filters],
  );
  const filteredCollection = useMemo(
    () => filterCollection(collection, filters),
    [collection, filters],
  );

  return (
    <div className="view-grid analytics-view">
      <header className="analytics-page-header">
        <h2>{t("analytics.title")}</h2>
      </header>

      <AnalyticsTabs t={t} activeTab={activeTab} onChange={setActiveTab} />

      <AnalyticsFilterBar
        t={t}
        filters={filters}
        categories={categories}
        subcategories={subcategories}
        onChange={setFilters}
      />

      {activeTab === "user" ? (
        <UserAnalyticsTab t={t} attempts={filteredAttempts} collection={filteredCollection} />
      ) : (
        <QuestionBankAnalyticsTab t={t} collection={filteredCollection} />
      )}
    </div>
  );
}

function AnalyticsTabs({
  t,
  activeTab,
  onChange,
}: {
  t: Translator;
  activeTab: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
}) {
  return (
    <div className="analytics-top-tabs" role="tablist" aria-label={t("analytics.tabsAriaLabel")}>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "user"}
        className={activeTab === "user" ? "analytics-tab active" : "analytics-tab"}
        onClick={() => onChange("user")}
      >
        {t("analytics.userTab")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "bank"}
        className={activeTab === "bank" ? "analytics-tab active" : "analytics-tab"}
        onClick={() => onChange("bank")}
      >
        {t("analytics.bankTab")}
      </button>
    </div>
  );
}

function AnalyticsFilterBar({
  t,
  filters,
  categories,
  subcategories,
  onChange,
}: {
  t: Translator;
  filters: AnalyticsFilters;
  categories: string[];
  subcategories: string[];
  onChange: (filters: AnalyticsFilters) => void;
}) {
  return (
    <Card
      title={t("analytics.filtersTitle")}
      subtitle={t("analytics.filtersSubtitle")}
      className="analytics-filter-card"
    >
      <div className="analytics-filter-grid">
        <label>
          <span>{t("analytics.dateRange")}</span>
          <select
            value={filters.dateRange}
            onChange={(event) =>
              onChange({ ...filters, dateRange: event.target.value as DateRange })
            }
          >
            <option value="all">{t("analytics.allTime")}</option>
            <option value="30">{t("analytics.last30Days")}</option>
            <option value="90">{t("analytics.last90Days")}</option>
          </select>
        </label>
        <label>
          <span>{t("analytics.category")}</span>
          <select
            value={filters.category}
            onChange={(event) =>
              onChange({ ...filters, category: event.target.value, subcategory: "all" })
            }
          >
            <option value="all">{t("analytics.allCategories")}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("analytics.subcategory")}</span>
          <select
            value={filters.subcategory}
            onChange={(event) => onChange({ ...filters, subcategory: event.target.value })}
          >
            <option value="all">{t("analytics.allSubcategories")}</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Card>
  );
}

function UserAnalyticsTab({
  t,
  attempts,
  collection,
}: {
  t: Translator;
  attempts: CompletedTestAttempt[];
  collection: QuestionCollection | null;
}) {
  const summary = calculateAnalyticsSummary(attempts);
  const trend = calculateRecentTrend(attempts);
  const trendDelta = calculateTrendDelta(attempts);
  const gradeDistribution = calculateGradeDistribution(attempts);
  const outcomeDistribution = calculateAnswerOutcomeDistribution(attempts);
  const categories = calculateCategoryPerformance(attempts);
  const strongest = getStrongestCategories(categories).map((category) =>
    categoryToRanking(t, category),
  );
  const weakest = getWeakestCategories(categories).map((category) =>
    categoryToRanking(t, category),
  );
  const failedQuestions = getMostFailedQuestions(collection);
  const insights = buildUserInsights(attempts, collection);

  if (attempts.length === 0) {
    return (
      <Card
        title={t("analytics.userTab")}
        subtitle={t("analytics.userEmptySubtitle")}
        className="analytics-empty-card"
      >
        <p className="placeholder-note">{t("analytics.userEmptyBody")}</p>
      </Card>
    );
  }

  return (
    <>
      <AnalyticsKpiGrid
        t={t}
        items={[
          [
            t("analytics.completedTests"),
            String(summary.testsCompleted),
            t("analytics.completedSessions"),
          ],
          [
            t("analytics.averageGrade"),
            `${summary.averageGrade.toFixed(1)} / 10`,
            t("analytics.meanFinalGrade"),
          ],
          [
            t("analytics.bestGradeLabel"),
            `${summary.bestGrade.toFixed(1)} / 10`,
            t("analytics.highestResult"),
          ],
          [
            t("analytics.worstGrade"),
            `${summary.worstGrade.toFixed(1)} / 10`,
            t("analytics.lowestResult"),
          ],
          [
            t("analytics.accuracy"),
            `${summary.accuracy.toFixed(1)}%`,
            t("analytics.answeredOriginals"),
          ],
          [
            t("analytics.correct"),
            String(summary.correctAnswers),
            t("analytics.originalQuestions"),
          ],
          [
            t("analytics.incorrect"),
            String(summary.incorrectAnswers),
            t("analytics.originalQuestions"),
          ],
          [
            t("analytics.unanswered"),
            String(summary.unansweredQuestions),
            t("analytics.originalQuestions"),
          ],
          [
            t("analytics.studyTime"),
            formatDuration(t, summary.totalStudyTime),
            t("analytics.completedSessions"),
          ],
          [
            t("analytics.recentTrend"),
            t(`analytics.trend.${trendDelta.label}`),
            t("analytics.gradeDelta", { value: trendDelta.value.toFixed(1) }),
          ],
        ]}
      />

      <Card
        title={t("analytics.trendTitle")}
        subtitle={t("analytics.trendSubtitle")}
        className="analytics-wide-card"
      >
        <div className="analytics-bars">
          {trend.map((item) => (
            <div key={`${item.label}-${item.title}`} className="analytics-bar-row">
              <span>{truncate(item.title, 42)}</span>
              <div
                className="analytics-bar-track"
                aria-label={t("analytics.gradeOutOfTen", { value: item.grade.toFixed(1) })}
              >
                <span style={{ width: `${item.grade * 10}%` }} />
              </div>
              <strong>{item.grade.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </Card>

      <DistributionBars
        title={t("analytics.gradeDistribution")}
        subtitle={t("analytics.gradeDistributionSubtitle")}
        items={gradeDistribution}
        t={t}
      />
      <DistributionBars
        title={t("analytics.answerOutcomes")}
        subtitle={t("analytics.answerOutcomesSubtitle")}
        items={translateDistributionItems(t, outcomeDistribution, "outcome")}
        t={t}
      />
      <RankingList
        title={t("analytics.strongestCategories")}
        subtitle={t("analytics.strongestCategoriesSubtitle")}
        items={strongest}
        t={t}
      />
      <RankingList
        title={t("analytics.weakestCategories")}
        subtitle={t("analytics.weakestCategoriesSubtitle")}
        items={weakest}
        t={t}
      />
      <RankingList
        title={t("analytics.mostFailedQuestions")}
        subtitle={t("analytics.mostFailedQuestionsSubtitle")}
        items={failedQuestions.map((item) => ({
          ...item,
          value: t("analytics.failedCount", { count: item.value }),
        }))}
        t={t}
      />
      <InsightPanel
        t={t}
        title={t("analytics.studyRecommendations")}
        insights={insights.map((insight) => formatUserInsight(t, insight))}
      />
    </>
  );
}

function QuestionBankAnalyticsTab({
  t,
  collection,
}: {
  t: Translator;
  collection: QuestionCollection | null;
}) {
  const summary = calculateBankSummary(collection);
  const categoryDistribution = calculateQuestionDistribution(
    collection?.questions ?? [],
    "category",
  );
  const subcategoryDistribution = calculateQuestionDistribution(
    collection?.questions ?? [],
    "subcategory",
  );
  const exposureDistribution = calculateExposureDistribution(collection);
  const seenDistribution = calculateSeenDistribution(collection);
  const userDifficulty = calculateDifficultyDistribution(collection, "userDeclaredDifficulty");
  const computedDifficulty = calculateDifficultyDistribution(collection, "computedDifficulty");
  const exposureRankings = getQuestionExposureRankings(collection);
  const smartHealth = calculateSmartSelectionHealth(collection);
  const insights = buildBankInsights(collection);
  const representedTopics = categoryDistribution.map((item) => ({
    label: item.label,
    value: String(item.value),
    detail: t("analytics.percentOfBank", { value: item.percentage.toFixed(1) }),
    score: item.value,
  }));
  const leastRepresentedTopics = representedTopics.slice().reverse();

  if (!collection || collection.questions.length === 0) {
    return (
      <Card
        title={t("analytics.bankTab")}
        subtitle={t("analytics.bankEmptySubtitle")}
        className="analytics-empty-card"
      >
        <p className="placeholder-note">{t("analytics.bankEmptyBody")}</p>
      </Card>
    );
  }

  return (
    <>
      <AnalyticsKpiGrid
        t={t}
        items={[
          [
            t("analytics.totalQuestions"),
            String(summary.totalQuestions),
            t("analytics.importedAndValid"),
          ],
          [t("analytics.categories"), String(summary.totalCategories), t("analytics.topicGroups")],
          [
            t("analytics.subcategories"),
            String(summary.totalSubcategories),
            t("analytics.optionalGranularity"),
          ],
          [t("analytics.neverSeen"), String(summary.neverSeen), t("analytics.exposureZero")],
          [
            t("analytics.coverage"),
            `${summary.coveragePercentage.toFixed(1)}%`,
            t("analytics.seenAtLeastOnce"),
          ],
          [
            t("analytics.averageExposure"),
            summary.averageExposure.toFixed(1),
            t("analytics.viewsPerQuestion"),
          ],
          [
            t("analytics.mostRepresented"),
            summary.mostRepresentedCategory || t("analytics.noData"),
            t("analytics.largestTopic"),
          ],
          [
            t("analytics.leastRepresented"),
            summary.leastRepresentedCategory || t("analytics.noData"),
            t("analytics.smallestTopic"),
          ],
          [
            t("analytics.difficultyCoverage"),
            `${summary.difficultyCoveragePercentage.toFixed(1)}%`,
            t("analytics.userRatedQuestions"),
          ],
          [
            t("analytics.smartHealth"),
            `${smartHealth.score.toFixed(0)} / 100`,
            t("analytics.coverageBalanceEstimate"),
          ],
        ]}
      />

      <DistributionBars
        title={t("analytics.questionsByCategory")}
        subtitle={t("analytics.questionsByCategorySubtitle")}
        items={categoryDistribution.slice(0, 10)}
        t={t}
      />
      <DistributionBars
        title={t("analytics.questionsBySubcategory")}
        subtitle={t("analytics.questionsBySubcategorySubtitle")}
        items={translateDistributionItems(t, subcategoryDistribution.slice(0, 10), "subcategory")}
        t={t}
      />
      <DistributionBars
        title={t("analytics.exposureDistribution")}
        subtitle={t("analytics.exposureDistributionSubtitle")}
        items={translateDistributionItems(t, exposureDistribution, "exposure")}
        t={t}
      />
      <DistributionBars
        title={t("analytics.seenVsNeverSeen")}
        subtitle={t("analytics.seenVsNeverSeenSubtitle")}
        items={translateDistributionItems(t, seenDistribution, "seen")}
        t={t}
      />
      <DistributionBars
        title={t("analytics.userRatedDifficulty")}
        subtitle={t("analytics.userRatedDifficultySubtitle")}
        items={translateDistributionItems(t, userDifficulty, "difficulty")}
        t={t}
      />
      <DistributionBars
        title={t("analytics.computedDifficulty")}
        subtitle={t("analytics.computedDifficultySubtitle")}
        items={translateDistributionItems(t, computedDifficulty, "difficulty")}
        t={t}
      />
      <RankingList
        title={t("analytics.mostRepresentedTopics")}
        subtitle={t("analytics.mostRepresentedTopicsSubtitle")}
        items={representedTopics.slice(0, 5)}
        t={t}
      />
      <RankingList
        title={t("analytics.leastRepresentedTopics")}
        subtitle={t("analytics.leastRepresentedTopicsSubtitle")}
        items={leastRepresentedTopics.slice(0, 5)}
        t={t}
      />
      <RankingList
        title={t("analytics.mostViewedQuestions")}
        subtitle={t("analytics.mostViewedQuestionsSubtitle")}
        items={exposureRankings.mostViewed.map((item) => ({
          ...item,
          value: t("analytics.viewCount", { count: item.value }),
        }))}
        t={t}
      />
      <RankingList
        title={t("analytics.leastViewedQuestions")}
        subtitle={t("analytics.leastViewedQuestionsSubtitle")}
        items={exposureRankings.leastViewed.map((item) => ({
          ...item,
          value: t("analytics.viewCount", { count: item.value }),
        }))}
        t={t}
      />
      <Card
        title={t("analytics.smartSelectionHealth")}
        subtitle={t("analytics.smartSelectionHealthSubtitle")}
        className="analytics-half-card"
      >
        <div className="analytics-health-grid">
          <HealthMetric
            label={t("analytics.coverage")}
            value={`${smartHealth.coveragePercentage.toFixed(1)}%`}
          />
          <HealthMetric
            label={t("analytics.unseenBacklog")}
            value={String(smartHealth.unseenBacklog)}
          />
          <HealthMetric
            label={t("analytics.exposureImbalance")}
            value={smartHealth.exposureImbalance.toFixed(1)}
          />
          <HealthMetric
            label={t("analytics.underrepresentedTopics")}
            value={String(smartHealth.underrepresentedCategories.length)}
          />
        </div>
      </Card>
      <InsightPanel
        t={t}
        title={t("analytics.bankRecommendations")}
        insights={insights.map((insight) => formatBankInsight(t, insight))}
      />
    </>
  );
}

function AnalyticsKpiGrid({ t, items }: { t: Translator; items: Array<[string, string, string]> }) {
  return (
    <Card
      title={t("analytics.keyMetrics")}
      subtitle={t("analytics.keyMetricsSubtitle")}
      className="analytics-wide-card"
    >
      <div className="kpi-grid analytics-kpi-grid">
        {items.map(([label, value, change]) => (
          <MetricCard key={label} item={{ label, value, change }} />
        ))}
      </div>
    </Card>
  );
}

function DistributionBars({
  t,
  title,
  subtitle,
  items,
}: {
  t: Translator;
  title: string;
  subtitle: string;
  items: DistributionItem[];
}) {
  return (
    <Card title={title} subtitle={subtitle} className="analytics-half-card">
      <div className="analytics-bars">
        {items.map((item) => (
          <div key={item.label} className="analytics-bar-row">
            <span>{item.label}</span>
            <div
              className="analytics-bar-track"
              aria-label={t("analytics.itemsCount", { count: item.value })}
            >
              <span style={{ width: `${Math.max(3, item.percentage)}%` }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RankingList({
  t,
  title,
  subtitle,
  items,
}: {
  t: Translator;
  title: string;
  subtitle: string;
  items: RankingItem[];
}) {
  return (
    <Card title={title} subtitle={subtitle} className="analytics-half-card">
      {items.length > 0 ? (
        <div className="analytics-ranking-list">
          {items.map((item, index) => (
            <article key={`${item.label}-${index}`} className="analytics-ranking-row">
              <span className="analytics-rank">#{index + 1}</span>
              <div>
                <strong>{truncate(item.label, 86)}</strong>
                <p>{item.detail}</p>
              </div>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      ) : (
        <p className="placeholder-note">{t("analytics.noMatchingData")}</p>
      )}
    </Card>
  );
}

function InsightPanel({
  t,
  title,
  insights,
}: {
  t: Translator;
  title: string;
  insights: string[];
}) {
  return (
    <Card
      title={title}
      subtitle={t("analytics.insightPanelSubtitle")}
      className="analytics-wide-card"
    >
      <div className="analytics-insight-list">
        {insights.map((insight) => (
          <article key={insight} className="analytics-insight">
            <strong>{t("analytics.insightLabel")}</strong>
            <p>{insight}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

function HealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="analytics-health-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function categoryToRanking(
  t: Translator,
  category: ReturnType<typeof calculateCategoryPerformance>[number],
) {
  return {
    label: category.category,
    value: `${category.accuracyPercentage.toFixed(1)}%`,
    detail: t("analytics.categoryRankingDetail", {
      correct: category.correct,
      incorrect: category.incorrect,
      unanswered: category.unanswered,
    }),
    score: category.accuracyPercentage,
  };
}

function translateDistributionItems(
  t: Translator,
  items: DistributionItem[],
  group: "outcome" | "exposure" | "seen" | "difficulty" | "subcategory",
) {
  return items.map((item) => ({
    ...item,
    label: translateDistributionLabel(t, item.label, group),
  }));
}

function translateDistributionLabel(
  t: Translator,
  label: string,
  group: "outcome" | "exposure" | "seen" | "difficulty" | "subcategory",
) {
  if (group === "subcategory" && label === "noSubcategory") {
    return t("analytics.noSubcategory");
  }
  if (group === "outcome") return t(`analytics.outcome.${label}`);
  if (group === "exposure") return t(`analytics.exposure.${label}`);
  if (group === "seen") return t(`analytics.seen.${label}`);
  if (group === "difficulty") return t(`analytics.difficulty.${label}`);
  return label;
}

function formatUserInsight(t: Translator, insight: UserInsight) {
  if (insight.code === "completeTest") return t("analytics.insights.completeTest");
  if (insight.code === "focusWeakCategory") {
    return t("analytics.insights.focusWeakCategory", {
      category: insight.category,
      accuracy: insight.accuracy.toFixed(1),
      total: insight.total,
    });
  }
  if (insight.code === "trendImproving") {
    return t("analytics.insights.trendImproving", { delta: insight.delta.toFixed(1) });
  }
  if (insight.code === "trendDeclining") {
    return t("analytics.insights.trendDeclining", { delta: insight.delta.toFixed(1) });
  }
  if (insight.code === "unansweredPractice") {
    return t("analytics.insights.unansweredPractice", { count: insight.count });
  }
  if (insight.code === "reviewMissed") {
    return t("analytics.insights.reviewMissed", { question: insight.question });
  }
  return t("analytics.insights.balanced");
}

function formatBankInsight(t: Translator, insight: BankInsight) {
  if (insight.code === "importBank") return t("analytics.insights.importBank");
  if (insight.code === "unseenBacklog") {
    return t("analytics.insights.unseenBacklog", { count: insight.count });
  }
  if (insight.code === "rateDifficulty") {
    return t("analytics.insights.rateDifficulty", { percentage: insight.percentage.toFixed(1) });
  }
  if (insight.code === "exposureUneven") return t("analytics.insights.exposureUneven");
  if (insight.code === "underrepresentedTopic") {
    return t("analytics.insights.underrepresentedTopic", { topic: insight.topic });
  }
  return t("analytics.insights.healthy");
}

function filterAttempts(attempts: CompletedTestAttempt[], filters: AnalyticsFilters) {
  const earliest = getEarliestDate(filters.dateRange);
  return attempts.filter((attempt) => {
    if (earliest && new Date(attempt.completedAt).getTime() < earliest.getTime()) return false;
    if (filters.category !== "all") {
      return attempt.categoryResults.some((category) => category.category === filters.category);
    }
    return true;
  });
}

function filterCollection(collection: QuestionCollection | null, filters: AnalyticsFilters) {
  if (!collection) return null;
  return {
    ...collection,
    questions: collection.questions.filter((question) => {
      const categoryMatches =
        filters.category === "all" || question.questionCategory === filters.category;
      const subcategoryMatches =
        filters.subcategory === "all" || question.questionSubcategory === filters.subcategory;
      return categoryMatches && subcategoryMatches;
    }),
  };
}

function getEarliestDate(dateRange: DateRange) {
  if (dateRange === "all") return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(dateRange));
  return date;
}

function formatDuration(t: Translator, seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return t("analytics.durationHoursMinutes", { hours, minutes });
  return t("analytics.durationMinutes", { minutes });
}
