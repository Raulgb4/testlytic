import {
  CollectionQuestion,
  DifficultyLevel,
  QuestionCollection,
} from "../test/questionCollectionTypes";
import { CompletedTestAttempt } from "../test/testTypes";

export type DistributionItem = {
  label: string;
  value: number;
  percentage: number;
};

export type RankingItem = {
  label: string;
  value: string;
  detail: string;
  score: number;
};

export type CategoryPerformanceItem = {
  category: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  accuracyPercentage: number;
};

export function calculateAnalyticsSummary(attempts: CompletedTestAttempt[]) {
  const testsCompleted = attempts.length;
  const totalGrade = attempts.reduce((sum, attempt) => sum + attempt.gradeOutOf10, 0);
  const totalQuestionsAnswered = attempts.reduce(
    (sum, attempt) => sum + attempt.correctAnswers + attempt.incorrectAnswers,
    0,
  );
  const correctAnswers = attempts.reduce((sum, attempt) => sum + attempt.correctAnswers, 0);
  const incorrectAnswers = attempts.reduce((sum, attempt) => sum + attempt.incorrectAnswers, 0);
  const unansweredQuestions = attempts.reduce(
    (sum, attempt) => sum + attempt.unansweredQuestions,
    0,
  );
  const totalStudyTime = attempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0);
  const categoryPerformance = calculateCategoryPerformance(attempts);

  return {
    testsCompleted,
    averageGrade: testsCompleted > 0 ? totalGrade / testsCompleted : 0,
    bestGrade:
      testsCompleted > 0 ? Math.max(...attempts.map((attempt) => attempt.gradeOutOf10)) : 0,
    worstGrade:
      testsCompleted > 0 ? Math.min(...attempts.map((attempt) => attempt.gradeOutOf10)) : 0,
    accuracy: totalQuestionsAnswered > 0 ? (correctAnswers / totalQuestionsAnswered) * 100 : 0,
    totalQuestionsAnswered,
    totalStudyTime,
    correctAnswers,
    incorrectAnswers,
    unansweredQuestions,
    mostUsedCategory: categoryPerformance[0]?.category || "",
    strongestCategory: getStrongestCategories(categoryPerformance, 1)[0]?.category || "",
    weakestCategory: getWeakestCategories(categoryPerformance, 1)[0]?.category || "",
  };
}

export function calculateGradeDistribution(attempts: CompletedTestAttempt[]) {
  const buckets = [
    { label: "0-2", value: 0 },
    { label: "2-4", value: 0 },
    { label: "4-6", value: 0 },
    { label: "6-8", value: 0 },
    { label: "8-10", value: 0 },
  ];
  for (const attempt of attempts) {
    const index = Math.min(4, Math.max(0, Math.floor(attempt.gradeOutOf10 / 2)));
    buckets[index].value += 1;
  }
  return withPercentages(buckets);
}

export function calculateAnswerOutcomeDistribution(attempts: CompletedTestAttempt[]) {
  const correct = attempts.reduce((sum, attempt) => sum + attempt.correctAnswers, 0);
  const incorrect = attempts.reduce((sum, attempt) => sum + attempt.incorrectAnswers, 0);
  const unanswered = attempts.reduce((sum, attempt) => sum + attempt.unansweredQuestions, 0);
  return withPercentages([
    { label: "Correct", value: correct },
    { label: "Incorrect", value: incorrect },
    { label: "Unanswered", value: unanswered },
  ]);
}

export function calculateCategoryPerformance(attempts: CompletedTestAttempt[]) {
  const map = new Map<
    string,
    { correct: number; incorrect: number; unanswered: number; total: number }
  >();
  for (const attempt of attempts) {
    for (const category of attempt.categoryResults) {
      const current = map.get(category.category) ?? {
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        total: 0,
      };
      current.correct += category.correct;
      current.incorrect += category.incorrect;
      current.unanswered += category.unanswered;
      current.total += category.total;
      map.set(category.category, current);
    }
  }
  return Array.from(map.entries())
    .map(([category, result]) => ({
      category,
      ...result,
      accuracyPercentage: result.total > 0 ? (result.correct / result.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getStrongestCategories(categories: CategoryPerformanceItem[], limit = 5) {
  return categories
    .filter((category) => category.total > 0)
    .slice()
    .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage || b.total - a.total)
    .slice(0, limit);
}

export function getWeakestCategories(categories: CategoryPerformanceItem[], limit = 5) {
  return categories
    .filter((category) => category.total > 0)
    .slice()
    .sort((a, b) => a.accuracyPercentage - b.accuracyPercentage || b.total - a.total)
    .slice(0, limit);
}

export function calculateRecentTrend(attempts: CompletedTestAttempt[]) {
  return attempts
    .slice()
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .slice(-8)
    .map((attempt, index) => ({
      label: `${index + 1}`,
      grade: attempt.gradeOutOf10,
      title: attempt.testTitle,
    }));
}

export function calculateTrendDelta(attempts: CompletedTestAttempt[]) {
  const sorted = attempts
    .slice()
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
  if (sorted.length < 2) return { label: "Not enough data", value: 0 };
  const windowSize = Math.min(5, Math.floor(sorted.length / 2));
  const previous = sorted.slice(-windowSize * 2, -windowSize);
  const recent = sorted.slice(-windowSize);
  const previousAverage = average(previous.map((attempt) => attempt.gradeOutOf10));
  const recentAverage = average(recent.map((attempt) => attempt.gradeOutOf10));
  const value = recentAverage - previousAverage;
  if (value > 0.25) return { label: "Improving", value };
  if (value < -0.25) return { label: "Declining", value };
  return { label: "Stable", value };
}

export function calculateBankSummary(collection: QuestionCollection | null) {
  const questions = collection?.questions ?? [];
  const totalQuestions = questions.length;
  const categories = unique(questions.map((question) => question.questionCategory));
  const subcategories = unique(
    questions.map((question) => question.questionSubcategory).filter(Boolean) as string[],
  );
  const neverSeen = questions.filter((question) => question.analytics.exposureCount === 0).length;
  const exposureTotal = questions.reduce(
    (sum, question) => sum + question.analytics.exposureCount,
    0,
  );
  const userRated = questions.filter(
    (question) => question.analytics.userDeclaredDifficulty !== "unrated",
  ).length;
  const categoryDistribution = calculateQuestionDistribution(questions, "category");

  return {
    totalQuestions,
    totalCategories: categories.length,
    totalSubcategories: subcategories.length,
    neverSeen,
    coveragePercentage:
      totalQuestions > 0 ? ((totalQuestions - neverSeen) / totalQuestions) * 100 : 0,
    averageExposure: totalQuestions > 0 ? exposureTotal / totalQuestions : 0,
    mostRepresentedCategory: categoryDistribution[0]?.label || "No data",
    leastRepresentedCategory:
      categoryDistribution.slice().sort((a, b) => a.value - b.value)[0]?.label || "No data",
    difficultyCoveragePercentage: totalQuestions > 0 ? (userRated / totalQuestions) * 100 : 0,
  };
}

export function calculateQuestionDistribution(
  questionsOrCollection: QuestionCollection | CollectionQuestion[],
  groupBy: "category" | "subcategory",
) {
  const questions = Array.isArray(questionsOrCollection)
    ? questionsOrCollection
    : questionsOrCollection.questions;
  const counts = new Map<string, number>();
  for (const question of questions) {
    const label =
      groupBy === "category"
        ? question.questionCategory
        : question.questionSubcategory || "No subcategory";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return withPercentages(
    Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  );
}

export function calculateExposureDistribution(collection: QuestionCollection | null) {
  const buckets = [
    { label: "Never seen", value: 0 },
    { label: "Seen once", value: 0 },
    { label: "2-3 views", value: 0 },
    { label: "4-7 views", value: 0 },
    { label: "8+ views", value: 0 },
  ];
  for (const question of collection?.questions ?? []) {
    const exposure = question.analytics.exposureCount;
    if (exposure === 0) buckets[0].value += 1;
    else if (exposure === 1) buckets[1].value += 1;
    else if (exposure <= 3) buckets[2].value += 1;
    else if (exposure <= 7) buckets[3].value += 1;
    else buckets[4].value += 1;
  }
  return withPercentages(buckets);
}

export function calculateSeenDistribution(collection: QuestionCollection | null) {
  const total = collection?.questions.length ?? 0;
  const neverSeen =
    collection?.questions.filter((q) => q.analytics.exposureCount === 0).length ?? 0;
  return withPercentages([
    { label: "Seen", value: total - neverSeen },
    { label: "Never seen", value: neverSeen },
  ]);
}

export function calculateDifficultyDistribution(
  collection: QuestionCollection | null,
  field: "userDeclaredDifficulty" | "computedDifficulty",
) {
  const order: DifficultyLevel[] = ["unrated", "low", "medium", "high"];
  const labels: Record<DifficultyLevel, string> = {
    unrated: "Unrated",
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  const buckets = order.map((level) => ({ label: labels[level], value: 0 }));
  for (const question of collection?.questions ?? []) {
    const index = order.indexOf(question.analytics[field]);
    buckets[index >= 0 ? index : 0].value += 1;
  }
  return withPercentages(buckets);
}

export function getMostFailedQuestions(collection: QuestionCollection | null, limit = 5) {
  return (collection?.questions ?? [])
    .filter((question) => question.analytics.timesAnsweredIncorrectly > 0)
    .slice()
    .sort(
      (a, b) =>
        b.analytics.timesAnsweredIncorrectly - a.analytics.timesAnsweredIncorrectly ||
        b.analytics.exposureCount - a.analytics.exposureCount,
    )
    .slice(0, limit)
    .map((question) => ({
      label: question.question,
      value: `${question.analytics.timesAnsweredIncorrectly} failed`,
      detail: `${question.questionCategory}${question.questionSubcategory ? ` · ${question.questionSubcategory}` : ""}`,
      score: question.analytics.timesAnsweredIncorrectly,
    }));
}

export function getQuestionExposureRankings(collection: QuestionCollection | null, limit = 5) {
  const questions = collection?.questions ?? [];
  const toRanking = (question: CollectionQuestion) => ({
    label: question.question,
    value: `${question.analytics.exposureCount} views`,
    detail: `${question.questionCategory}${question.questionSubcategory ? ` · ${question.questionSubcategory}` : ""}`,
    score: question.analytics.exposureCount,
  });
  return {
    mostViewed: questions
      .slice()
      .sort((a, b) => b.analytics.exposureCount - a.analytics.exposureCount)
      .slice(0, limit)
      .map(toRanking),
    leastViewed: questions
      .slice()
      .sort((a, b) => a.analytics.exposureCount - b.analytics.exposureCount)
      .slice(0, limit)
      .map(toRanking),
  };
}

export function calculateSmartSelectionHealth(collection: QuestionCollection | null) {
  const summary = calculateBankSummary(collection);
  const distribution = calculateQuestionDistribution(collection?.questions ?? [], "category");
  const averageCategoryShare = distribution.length > 0 ? 100 / distribution.length : 0;
  const underrepresentedCategories = distribution.filter(
    (item) => item.percentage < averageCategoryShare * 0.5,
  );
  const exposures = (collection?.questions ?? []).map(
    (question) => question.analytics.exposureCount,
  );
  const maxExposure = exposures.length > 0 ? Math.max(...exposures) : 0;
  const exposureImbalance = maxExposure - summary.averageExposure;
  const score = Math.max(
    0,
    Math.min(
      100,
      summary.coveragePercentage - exposureImbalance * 3 - underrepresentedCategories.length * 4,
    ),
  );

  return {
    score,
    coveragePercentage: summary.coveragePercentage,
    unseenBacklog: summary.neverSeen,
    exposureImbalance,
    underrepresentedCategories,
  };
}

export function buildUserInsights(
  attempts: CompletedTestAttempt[],
  collection: QuestionCollection | null,
) {
  if (attempts.length === 0) {
    return ["Complete a test to unlock performance recommendations."];
  }
  const summary = calculateAnalyticsSummary(attempts);
  const categories = calculateCategoryPerformance(attempts);
  const weakest = getWeakestCategories(categories, 1)[0];
  const trend = calculateTrendDelta(attempts);
  const failed = getMostFailedQuestions(collection, 1)[0];
  const insights = [];

  if (weakest) {
    insights.push(
      `Focus next on ${weakest.category}: ${weakest.accuracyPercentage.toFixed(1)}% accuracy across ${weakest.total} questions.`,
    );
  }
  if (trend.label === "Improving") {
    insights.push(
      `Recent results are improving by ${trend.value.toFixed(1)} points. Keep the current routine.`,
    );
  } else if (trend.label === "Declining") {
    insights.push(
      `Recent results are down ${Math.abs(trend.value).toFixed(1)} points. Use a shorter focused review session.`,
    );
  }
  if (summary.unansweredQuestions > 0) {
    insights.push(
      `You left ${summary.unansweredQuestions} questions unanswered. Practice timing and elimination strategy.`,
    );
  }
  if (failed) {
    insights.push(`Review repeatedly missed question: ${truncate(failed.label, 96)}`);
  }
  return insights.length > 0
    ? insights.slice(0, 4)
    : ["Performance is balanced. Add mixed tests to keep coverage broad."];
}

export function buildBankInsights(collection: QuestionCollection | null) {
  const summary = calculateBankSummary(collection);
  if (summary.totalQuestions === 0)
    return ["Import a question bank to inspect coverage and balance."];
  const health = calculateSmartSelectionHealth(collection);
  const insights = [];
  if (summary.neverSeen > 0) {
    insights.push(
      `${summary.neverSeen} questions are still unseen. Run broad tests to improve coverage.`,
    );
  }
  if (summary.difficultyCoveragePercentage < 60) {
    insights.push(
      `Only ${summary.difficultyCoveragePercentage.toFixed(1)}% of questions have user-rated difficulty. Rate more questions after review.`,
    );
  }
  if (health.exposureImbalance > 3) {
    insights.push(
      "Exposure is uneven. Smart Selection will favor less-seen questions to rebalance practice.",
    );
  }
  if (health.underrepresentedCategories.length > 0) {
    insights.push(
      `Underrepresented topic: ${health.underrepresentedCategories[0].label}. Import more questions if this area matters.`,
    );
  }
  return insights.length > 0
    ? insights.slice(0, 4)
    : ["Question bank coverage looks healthy for mixed practice."];
}

export function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function withPercentages(items: Array<{ label: string; value: number }>): DistributionItem[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items.map((item) => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
