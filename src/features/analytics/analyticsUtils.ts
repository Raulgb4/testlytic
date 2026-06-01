import { CompletedTestAttempt } from "../test/testTypes";

export function calculateAnalyticsSummary(attempts: CompletedTestAttempt[]) {
  const testsCompleted = attempts.length;
  const totalGrade = attempts.reduce((sum, attempt) => sum + attempt.gradeOutOf10, 0);
  const totalQuestionsAnswered = attempts.reduce(
    (sum, attempt) => sum + attempt.correctAnswers + attempt.incorrectAnswers,
    0,
  );
  const correctAnswers = attempts.reduce((sum, attempt) => sum + attempt.correctAnswers, 0);
  const incorrectAnswers = attempts.reduce((sum, attempt) => sum + attempt.incorrectAnswers, 0);
  const totalStudyTime = attempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0);
  const categoryPerformance = calculateCategoryPerformance(attempts);

  return {
    testsCompleted,
    averageGrade: testsCompleted > 0 ? totalGrade / testsCompleted : 0,
    bestGrade: testsCompleted > 0 ? Math.max(...attempts.map((attempt) => attempt.gradeOutOf10)) : 0,
    worstGrade: testsCompleted > 0 ? Math.min(...attempts.map((attempt) => attempt.gradeOutOf10)) : 0,
    accuracy: totalQuestionsAnswered > 0 ? (correctAnswers / totalQuestionsAnswered) * 100 : 0,
    totalQuestionsAnswered,
    totalStudyTime,
    correctAnswers,
    incorrectAnswers,
    mostUsedCategory: categoryPerformance[0]?.category || "",
    strongestCategory: categoryPerformance.reduce(
      (best, item) => (!best || item.accuracyPercentage > best.accuracyPercentage ? item : best),
      categoryPerformance[0],
    )?.category || "",
    weakestCategory: categoryPerformance.reduce(
      (weakest, item) => (!weakest || item.accuracyPercentage < weakest.accuracyPercentage ? item : weakest),
      categoryPerformance[0],
    )?.category || "",
  };
}

export function calculateGradeDistribution(attempts: CompletedTestAttempt[]) {
  const buckets = [
    { label: "0-2", count: 0 },
    { label: "2-4", count: 0 },
    { label: "4-6", count: 0 },
    { label: "6-8", count: 0 },
    { label: "8-10", count: 0 },
  ];
  for (const attempt of attempts) {
    const index = Math.min(4, Math.max(0, Math.floor(attempt.gradeOutOf10 / 2)));
    buckets[index].count += 1;
  }
  return buckets;
}

export function calculateCategoryPerformance(attempts: CompletedTestAttempt[]) {
  const map = new Map<string, { correct: number; incorrect: number; unanswered: number; total: number }>();
  for (const attempt of attempts) {
    for (const category of attempt.categoryResults) {
      const current = map.get(category.category) ?? { correct: 0, incorrect: 0, unanswered: 0, total: 0 };
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
