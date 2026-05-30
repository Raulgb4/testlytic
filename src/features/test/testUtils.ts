import { MOCK_QUESTIONS } from "./mockQuestions";
import { MockQuestion, TestConfig, TestResult } from "./testTypes";

export function formatTopicCategory(question: MockQuestion) {
  return `${question.topic} / ${question.category}`;
}

export function buildTopicCategories(allTopicsLabel: string, questions: MockQuestion[]) {
  return [allTopicsLabel, ...Array.from(new Set(questions.map(formatTopicCategory))).sort()];
}

export function getFilteredQuestions(config: TestConfig) {
  const base =
    config.topicCategory === "All Topics"
      ? MOCK_QUESTIONS
      : MOCK_QUESTIONS.filter((question) => formatTopicCategory(question) === config.topicCategory);
  return base.slice(0, Math.min(config.questionCount, base.length));
}

export function calculateResults(
  questions: MockQuestion[],
  answers: Record<string, string | null>,
  config: TestConfig,
): TestResult {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  for (const question of questions) {
    const selected = answers[question.id];
    if (!selected) {
      unanswered += 1;
      continue;
    }
    if (selected === question.correctOptionId) {
      correct += 1;
    } else {
      incorrect += 1;
    }
  }

  const score = correct - (config.negativeMarking ? incorrect * config.negativeMarkingValue : 0);

  return {
    total: questions.length,
    correct,
    incorrect,
    unanswered,
    score,
  };
}
