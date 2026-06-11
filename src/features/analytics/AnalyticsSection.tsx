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
  DistributionItem,
  RankingItem,
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
      <Card
        title={t("analytics.title")}
        subtitle="Professor-style local dashboard for performance, coverage, and study decisions."
        className="analytics-hero-card"
      >
        <AnalyticsTabs activeTab={activeTab} onChange={setActiveTab} />
      </Card>

      <AnalyticsFilterBar
        filters={filters}
        categories={categories}
        subcategories={subcategories}
        onChange={setFilters}
      />

      {activeTab === "user" ? (
        <UserAnalyticsTab attempts={filteredAttempts} collection={filteredCollection} />
      ) : (
        <QuestionBankAnalyticsTab collection={filteredCollection} />
      )}
    </div>
  );
}

function AnalyticsTabs({
  activeTab,
  onChange,
}: {
  activeTab: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
}) {
  return (
    <div className="analytics-tabs" role="tablist" aria-label="Analytics dashboards">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "user"}
        className={activeTab === "user" ? "analytics-tab active" : "analytics-tab"}
        onClick={() => onChange("user")}
      >
        User Analytics
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "bank"}
        className={activeTab === "bank" ? "analytics-tab active" : "analytics-tab"}
        onClick={() => onChange("bank")}
      >
        Question Bank Analytics
      </button>
    </div>
  );
}

function AnalyticsFilterBar({
  filters,
  categories,
  subcategories,
  onChange,
}: {
  filters: AnalyticsFilters;
  categories: string[];
  subcategories: string[];
  onChange: (filters: AnalyticsFilters) => void;
}) {
  return (
    <Card
      title="Filters"
      subtitle="Phase 1 filters are local and do not change stored data."
      className="analytics-filter-card"
    >
      <div className="analytics-filter-grid">
        <label>
          <span>Date range</span>
          <select
            value={filters.dateRange}
            onChange={(event) =>
              onChange({ ...filters, dateRange: event.target.value as DateRange })
            }
          >
            <option value="all">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
        <label>
          <span>Category</span>
          <select
            value={filters.category}
            onChange={(event) =>
              onChange({ ...filters, category: event.target.value, subcategory: "all" })
            }
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Subcategory</span>
          <select
            value={filters.subcategory}
            onChange={(event) => onChange({ ...filters, subcategory: event.target.value })}
          >
            <option value="all">All subcategories</option>
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
  attempts,
  collection,
}: {
  attempts: CompletedTestAttempt[];
  collection: QuestionCollection | null;
}) {
  const summary = calculateAnalyticsSummary(attempts);
  const trend = calculateRecentTrend(attempts);
  const trendDelta = calculateTrendDelta(attempts);
  const gradeDistribution = calculateGradeDistribution(attempts);
  const outcomeDistribution = calculateAnswerOutcomeDistribution(attempts);
  const categories = calculateCategoryPerformance(attempts);
  const strongest = getStrongestCategories(categories).map(categoryToRanking);
  const weakest = getWeakestCategories(categories).map(categoryToRanking);
  const failedQuestions = getMostFailedQuestions(collection);
  const insights = buildUserInsights(attempts, collection);

  if (attempts.length === 0) {
    return (
      <Card
        title="User Analytics"
        subtitle="No completed tests match the current filters."
        className="analytics-empty-card"
      >
        <p className="placeholder-note">
          Complete a test to populate personal performance, trend, and study guidance.
        </p>
      </Card>
    );
  }

  return (
    <>
      <AnalyticsKpiGrid
        items={[
          ["Tests completed", String(summary.testsCompleted), "Completed sessions"],
          ["Average grade", `${summary.averageGrade.toFixed(1)} / 10`, "Mean final grade"],
          ["Best grade", `${summary.bestGrade.toFixed(1)} / 10`, "Highest result"],
          ["Worst grade", `${summary.worstGrade.toFixed(1)} / 10`, "Lowest result"],
          ["Accuracy", `${summary.accuracy.toFixed(1)}%`, "Answered originals"],
          ["Correct", String(summary.correctAnswers), "Original questions"],
          ["Incorrect", String(summary.incorrectAnswers), "Original questions"],
          ["Unanswered", String(summary.unansweredQuestions), "Original questions"],
          ["Study time", formatDuration(summary.totalStudyTime), "Completed sessions"],
          ["Recent trend", trendDelta.label, `${trendDelta.value.toFixed(1)} grade delta`],
        ]}
      />

      <Card
        title="Performance Trend"
        subtitle="Recent completed test grades"
        className="analytics-wide-card"
      >
        <div className="analytics-bars">
          {trend.map((item) => (
            <div key={`${item.label}-${item.title}`} className="analytics-bar-row">
              <span>{truncate(item.title, 42)}</span>
              <div
                className="analytics-bar-track"
                aria-label={`${item.grade.toFixed(1)} out of 10`}
              >
                <span style={{ width: `${item.grade * 10}%` }} />
              </div>
              <strong>{item.grade.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </Card>

      <DistributionBars
        title="Grade Distribution"
        subtitle="Tests grouped by grade"
        items={gradeDistribution}
      />
      <DistributionBars
        title="Answer Outcomes"
        subtitle="Correct, incorrect, and unanswered"
        items={outcomeDistribution}
      />
      <RankingList
        title="Strongest Categories"
        subtitle="Best accuracy with available attempts"
        items={strongest}
      />
      <RankingList
        title="Weakest Categories"
        subtitle="Prioritize these topics for focused tests"
        items={weakest}
      />
      <RankingList
        title="Most Failed / Needs Review"
        subtitle="From existing question analytics"
        items={failedQuestions}
      />
      <InsightPanel title="Study Recommendations" insights={insights} />
    </>
  );
}

function QuestionBankAnalyticsTab({ collection }: { collection: QuestionCollection | null }) {
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
    detail: `${item.percentage.toFixed(1)}% of bank`,
    score: item.value,
  }));
  const leastRepresentedTopics = representedTopics.slice().reverse();

  if (!collection || collection.questions.length === 0) {
    return (
      <Card
        title="Question Bank Analytics"
        subtitle="No question bank is loaded."
        className="analytics-empty-card"
      >
        <p className="placeholder-note">
          Import a validated JSON question bank to inspect composition, coverage, and Smart
          Selection health.
        </p>
      </Card>
    );
  }

  return (
    <>
      <AnalyticsKpiGrid
        items={[
          ["Total questions", String(summary.totalQuestions), "Imported and valid"],
          ["Categories", String(summary.totalCategories), "Topic groups"],
          ["Subcategories", String(summary.totalSubcategories), "Optional granularity"],
          ["Never seen", String(summary.neverSeen), "Exposure count is zero"],
          ["Coverage", `${summary.coveragePercentage.toFixed(1)}%`, "Seen at least once"],
          ["Avg exposure", summary.averageExposure.toFixed(1), "Views per question"],
          ["Most represented", summary.mostRepresentedCategory, "Largest topic"],
          ["Least represented", summary.leastRepresentedCategory, "Smallest topic"],
          [
            "Difficulty coverage",
            `${summary.difficultyCoveragePercentage.toFixed(1)}%`,
            "User-rated questions",
          ],
          ["Smart health", `${smartHealth.score.toFixed(0)} / 100`, "Coverage balance estimate"],
        ]}
      />

      <DistributionBars
        title="Questions by Category"
        subtitle="Bank composition by topic"
        items={categoryDistribution.slice(0, 10)}
      />
      <DistributionBars
        title="Questions by Subcategory"
        subtitle="Top subtopics in current filters"
        items={subcategoryDistribution.slice(0, 10)}
      />
      <DistributionBars
        title="Exposure Distribution"
        subtitle="How often questions have appeared"
        items={exposureDistribution}
      />
      <DistributionBars
        title="Seen vs Never Seen"
        subtitle="Coverage across the bank"
        items={seenDistribution}
      />
      <DistributionBars
        title="User-Rated Difficulty"
        subtitle="Your manual difficulty labels"
        items={userDifficulty}
      />
      <DistributionBars
        title="Computed Difficulty"
        subtitle="Derived from existing answer stats"
        items={computedDifficulty}
      />
      <RankingList
        title="Most Represented Topics"
        subtitle="Largest topic groups"
        items={representedTopics.slice(0, 5)}
      />
      <RankingList
        title="Least Represented Topics"
        subtitle="Potential import gaps"
        items={leastRepresentedTopics.slice(0, 5)}
      />
      <RankingList
        title="Most Viewed Questions"
        subtitle="Highest exposure counts"
        items={exposureRankings.mostViewed}
      />
      <RankingList
        title="Least Viewed / Never Seen"
        subtitle="Smart Selection should prioritize these"
        items={exposureRankings.leastViewed}
      />
      <Card
        title="Smart Selection Health"
        subtitle="Coverage, unseen backlog, and exposure balance"
      >
        <div className="analytics-health-grid">
          <HealthMetric label="Coverage" value={`${smartHealth.coveragePercentage.toFixed(1)}%`} />
          <HealthMetric label="Unseen backlog" value={String(smartHealth.unseenBacklog)} />
          <HealthMetric
            label="Exposure imbalance"
            value={smartHealth.exposureImbalance.toFixed(1)}
          />
          <HealthMetric
            label="Underrepresented topics"
            value={String(smartHealth.underrepresentedCategories.length)}
          />
        </div>
      </Card>
      <InsightPanel title="Bank Recommendations" insights={insights} />
    </>
  );
}

function AnalyticsKpiGrid({ items }: { items: Array<[string, string, string]> }) {
  return (
    <Card
      title="Key Metrics"
      subtitle="At-a-glance dashboard summary"
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
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: DistributionItem[];
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="analytics-bars">
        {items.map((item) => (
          <div key={item.label} className="analytics-bar-row">
            <span>{item.label}</span>
            <div className="analytics-bar-track" aria-label={`${item.value} items`}>
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
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: RankingItem[];
}) {
  return (
    <Card title={title} subtitle={subtitle}>
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
        <p className="placeholder-note">No matching data yet.</p>
      )}
    </Card>
  );
}

function InsightPanel({ title, insights }: { title: string; insights: string[] }) {
  return (
    <Card
      title={title}
      subtitle="Actionable guidance from current local data"
      className="analytics-wide-card"
    >
      <div className="analytics-insight-list">
        {insights.map((insight) => (
          <article key={insight} className="analytics-insight">
            <strong>Insight</strong>
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

function categoryToRanking(category: ReturnType<typeof calculateCategoryPerformance>[number]) {
  return {
    label: category.category,
    value: `${category.accuracyPercentage.toFixed(1)}%`,
    detail: `${category.correct} correct · ${category.incorrect} incorrect · ${category.unanswered} unanswered`,
    score: category.accuracyPercentage,
  };
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

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
