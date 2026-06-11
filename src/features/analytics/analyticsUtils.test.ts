import { describe, expect, it } from "vitest";
import { QuestionCollection } from "../test/questionCollectionTypes";
import { CompletedTestAttempt } from "../test/testTypes";
import {
  calculateAnalyticsSummary,
  calculateBankSummary,
  calculateCategoryPerformance,
  calculateDifficultyDistribution,
  calculateExposureDistribution,
  calculateRecentTrend,
  calculateSeenDistribution,
  getStrongestCategories,
  getWeakestCategories,
} from "./analyticsUtils";

const attempts: CompletedTestAttempt[] = [
  {
    id: "a1",
    testId: "t1",
    testTitle: "First",
    startedAt: "2026-06-01T10:00:00.000Z",
    completedAt: "2026-06-01T10:30:00.000Z",
    durationSeconds: 1800,
    totalQuestions: 10,
    correctAnswers: 6,
    incorrectAnswers: 3,
    unansweredQuestions: 1,
    rawScore: 6,
    finalScore: 5.25,
    accuracyPercentage: 66.67,
    gradeOutOf10: 6,
    retryAttempts: 0,
    retryCorrectAnswers: 0,
    retryIncorrectAnswers: 0,
    categoryResults: [
      {
        category: "Law",
        correct: 4,
        incorrect: 1,
        unanswered: 0,
        total: 5,
        accuracyPercentage: 80,
      },
      {
        category: "Systems",
        correct: 2,
        incorrect: 2,
        unanswered: 1,
        total: 5,
        accuracyPercentage: 40,
      },
    ],
  },
  {
    id: "a2",
    testId: "t1",
    testTitle: "Second",
    startedAt: "2026-06-02T10:00:00.000Z",
    completedAt: "2026-06-02T10:20:00.000Z",
    durationSeconds: 1200,
    totalQuestions: 10,
    correctAnswers: 8,
    incorrectAnswers: 2,
    unansweredQuestions: 0,
    rawScore: 8,
    finalScore: 7.5,
    accuracyPercentage: 80,
    gradeOutOf10: 8,
    retryAttempts: 0,
    retryCorrectAnswers: 0,
    retryIncorrectAnswers: 0,
    categoryResults: [
      {
        category: "Law",
        correct: 3,
        incorrect: 2,
        unanswered: 0,
        total: 5,
        accuracyPercentage: 60,
      },
      {
        category: "Systems",
        correct: 4,
        incorrect: 1,
        unanswered: 0,
        total: 5,
        accuracyPercentage: 80,
      },
    ],
  },
];

const collection: QuestionCollection = {
  version: "1",
  importedAt: "2026-06-01T09:00:00.000Z",
  summary: {
    totalQuestions: 4,
    totalCategories: 2,
    totalSubcategories: 2,
    totalSingleChoice: 4,
    totalMultipleChoice: 0,
    totalSources: 1,
  },
  questions: [
    buildQuestion("q1", "Law", "Admin", 0, "unrated", "unrated"),
    buildQuestion("q2", "Law", "Admin", 1, "low", "low"),
    buildQuestion("q3", "Systems", "Security", 3, "medium", "high"),
    buildQuestion("q4", "Systems", undefined, 8, "high", "medium"),
  ],
};

describe("analyticsUtils", () => {
  it("calculates grade, answer, accuracy, and study-time summary", () => {
    const summary = calculateAnalyticsSummary(attempts);

    expect(summary.testsCompleted).toBe(2);
    expect(summary.averageGrade).toBe(7);
    expect(summary.bestGrade).toBe(8);
    expect(summary.worstGrade).toBe(6);
    expect(summary.accuracy).toBeCloseTo((14 / 19) * 100);
    expect(summary.correctAnswers).toBe(14);
    expect(summary.incorrectAnswers).toBe(5);
    expect(summary.unansweredQuestions).toBe(1);
    expect(summary.totalStudyTime).toBe(3000);
  });

  it("builds recent trend in chronological order", () => {
    expect(calculateRecentTrend(attempts).map((item) => item.grade)).toEqual([6, 8]);
  });

  it("ranks strongest and weakest categories", () => {
    const categories = calculateCategoryPerformance(attempts);

    expect(getStrongestCategories(categories, 1)[0].category).toBe("Law");
    expect(getWeakestCategories(categories, 1)[0].category).toBe("Systems");
  });

  it("calculates bank coverage and never-seen count", () => {
    const summary = calculateBankSummary(collection);

    expect(summary.totalQuestions).toBe(4);
    expect(summary.neverSeen).toBe(1);
    expect(summary.coveragePercentage).toBe(75);
    expect(summary.averageExposure).toBe(3);
  });

  it("calculates exposure and seen distributions", () => {
    expect(calculateExposureDistribution(collection).map((item) => item.value)).toEqual([
      1, 1, 1, 0, 1,
    ]);
    expect(calculateSeenDistribution(collection).map((item) => item.value)).toEqual([3, 1]);
  });

  it("calculates difficulty distributions", () => {
    expect(
      calculateDifficultyDistribution(collection, "userDeclaredDifficulty").map(
        (item) => item.value,
      ),
    ).toEqual([1, 1, 1, 1]);
    expect(
      calculateDifficultyDistribution(collection, "computedDifficulty").map((item) => item.value),
    ).toEqual([1, 1, 1, 1]);
  });

  it("does not mutate question analytics or exposure counts", () => {
    const snapshot = structuredClone(collection);

    calculateBankSummary(collection);
    calculateExposureDistribution(collection);
    calculateDifficultyDistribution(collection, "userDeclaredDifficulty");

    expect(collection).toEqual(snapshot);
  });
});

function buildQuestion(
  id: string,
  category: string,
  subcategory: string | undefined,
  exposureCount: number,
  userDeclaredDifficulty: "unrated" | "low" | "medium" | "high",
  computedDifficulty: "unrated" | "low" | "medium" | "high",
): QuestionCollection["questions"][number] {
  return {
    id,
    question: `Question ${id}`,
    questionType: "single_choice",
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    correctOptions: ["a"],
    shuffleOptions: true,
    questionCategory: category,
    questionSubcategory: subcategory,
    analytics: {
      computedDifficulty,
      userDeclaredDifficulty,
      timesAnsweredIncorrectly: exposureCount > 1 ? exposureCount - 1 : 0,
      timesAnsweredCorrectly: exposureCount > 0 ? 1 : 0,
      exposureCount,
    },
  };
}
