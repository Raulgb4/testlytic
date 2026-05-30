import { MockAnswerHistoryRow, MockCompletedAttempt } from "./analyticsTypes";

export function calculateAnalyticsSummary(attempts: MockCompletedAttempt[]) {
  if (attempts.length === 0) {
    return {
      averageScore: 0,
      completedTests: 0,
      accuracy: 0,
      weakestTopic: "",
    };
  }

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.scorePercent, 0);
  const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.correct, 0);
  const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.total, 0);

  const topicAggregate = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const current = topicAggregate.get(attempt.topic) ?? { correct: 0, total: 0 };
    current.correct += attempt.correct;
    current.total += attempt.total;
    topicAggregate.set(attempt.topic, current);
  }

  let weakestTopic = "";
  let weakestAccuracy = Infinity;
  for (const [topic, aggregate] of topicAggregate) {
    const topicAccuracy = aggregate.total > 0 ? aggregate.correct / aggregate.total : 1;
    if (topicAccuracy < weakestAccuracy) {
      weakestAccuracy = topicAccuracy;
      weakestTopic = topic;
    }
  }

  return {
    averageScore: totalScore / attempts.length,
    completedTests: attempts.length,
    accuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
    weakestTopic,
  };
}

export function filterHistoryRows(
  rows: MockAnswerHistoryRow[],
  query: string,
  topicFilter: string,
) {
  const normalized = query.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesTopic = topicFilter === "All Topics" || row.topic === topicFilter;
    const matchesSearch =
      normalized.length === 0 ||
      row.testTitle.toLowerCase().includes(normalized) ||
      row.topic.toLowerCase().includes(normalized) ||
      row.question.toLowerCase().includes(normalized);
    return matchesTopic && matchesSearch;
  });
}
