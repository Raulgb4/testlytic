import { describe, expect, it } from "vitest";
import { CollectionQuestion } from "./questionCollectionTypes";
import { ActiveTestAttempt, RuntimeAnswer, RuntimeQueueItem, TestDefinition } from "./testTypes";
import {
  calculateAttemptResult,
  getCategoryOptions,
  getMatchingQuestions,
  getSubcategoryOptions,
  isExactSetMatch,
} from "./testUtils";

const analytics: CollectionQuestion["analytics"] = {
  computedDifficulty: "unrated",
  userDeclaredDifficulty: "unrated",
  timesAnsweredIncorrectly: 0,
  timesAnsweredCorrectly: 0,
  exposureCount: 0,
};

function question(
  id: string,
  questionCategory: string,
  questionSubcategory?: string,
): CollectionQuestion {
  return {
    id,
    question: `Question ${id}`,
    questionType: "single_choice",
    questionCategory,
    questionSubcategory,
    options: [{ id: "a", text: "A" }],
    correctOptions: ["a"],
    shuffleOptions: true,
    analytics,
  };
}

function definition(
  includedCategories: string[],
  includedSubcategories?: string[],
): TestDefinition {
  return {
    id: "test-1",
    title: "Filtering test",
    questionLimit: 10,
    includedCategories,
    includedSubcategories,
    allowUnanswered: false,
    negativeMarkingEnabled: false,
    penaltyPerIncorrectAnswer: 0,
    timeLimitMinutes: 0,
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
  };
}

function ids(questions: CollectionQuestion[]) {
  return questions.map((item) => item.id);
}

function queueItem(
  queueId: string,
  questionCategory: string,
  questionSubcategory?: string,
  retryNumber = 0,
): RuntimeQueueItem {
  return {
    queueId,
    sourceQuestionId: queueId.split("-")[0],
    retryNumber,
    question: {
      id: queueId,
      question: `Question ${queueId}`,
      questionType: "single_choice",
      questionCategory,
      questionSubcategory,
      options: [{ id: "a", text: "A" }],
      correctOptions: ["a"],
    },
  };
}

function answer(isCorrect: boolean): RuntimeAnswer {
  return {
    selectedOptionIds: isCorrect ? ["a"] : ["b"],
    isCorrect,
    answeredAt: "2026-06-11T10:01:00.000Z",
    attemptNumber: 1,
  };
}

function activeAttempt(
  queue: RuntimeQueueItem[],
  submittedAnswers: ActiveTestAttempt["submittedAnswers"],
  overrides: Partial<ActiveTestAttempt> = {},
): ActiveTestAttempt {
  return {
    id: "active-1",
    testId: "test-1",
    startedAt: "2026-06-11T10:00:00.000Z",
    savedElapsedSeconds: 125,
    originalQuestionCount: queue.filter((item) => item.retryNumber === 0).length,
    currentQueueIndex: 0,
    draftSelections: {},
    queue,
    submittedAnswers,
    ...overrides,
  };
}

describe("option helpers", () => {
  const bank = [
    question("2", "T2", "A2.2012"),
    question("1", "T1", "A1.2019"),
    question("3", "T1", "A2.2012"),
    question("4", "T2"),
    question("5", "T1", "A1.2019"),
  ];

  it("returns sorted deduplicated category options", () => {
    expect(getCategoryOptions(bank)).toEqual(["T1", "T2"]);
  });

  it("returns sorted subcategory options filtered by selected categories", () => {
    expect(getSubcategoryOptions(bank, ["T1"])).toEqual(["A1.2019", "A2.2012"]);
    expect(getSubcategoryOptions(bank, ["T2"])).toEqual(["A2.2012"]);
  });

  it("omits questions without subcategories from subcategory options", () => {
    expect(getSubcategoryOptions(bank, ["T2"])).not.toContain("");
  });
});

describe("isExactSetMatch", () => {
  it("accepts exact matches in the same or different order", () => {
    expect(isExactSetMatch(["a", "b"], ["a", "b"])).toBe(true);
    expect(isExactSetMatch(["b", "a"], ["a", "b"])).toBe(true);
  });

  it("rejects missing, extra, and duplicate selected IDs", () => {
    expect(isExactSetMatch(["a"], ["a", "b"])).toBe(false);
    expect(isExactSetMatch(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isExactSetMatch(["a", "a"], ["a", "b"])).toBe(false);
  });
});

describe("getMatchingQuestions", () => {
  const bank = [
    question("t1-a1", "T1", "A1.2019"),
    question("t1-a2", "T1", "A2.2012"),
    question("t2-a1", "T2", "A1.2019"),
    question("t2-a2", "T2", "A2.2012"),
    question("t1-none", "T1"),
  ];

  it("matches T1 only, including questions without subcategory", () => {
    expect(ids(getMatchingQuestions(definition(["T1"]), bank))).toEqual([
      "t1-a1",
      "t1-a2",
      "t1-none",
    ]);
  });

  it("matches T1 + A1.2019", () => {
    expect(ids(getMatchingQuestions(definition(["T1"], ["A1.2019"]), bank))).toEqual(["t1-a1"]);
  });

  it("matches T1 + A2.2012", () => {
    expect(ids(getMatchingQuestions(definition(["T1"], ["A2.2012"]), bank))).toEqual(["t1-a2"]);
  });

  it("matches T1,T2 + A1.2019", () => {
    expect(ids(getMatchingQuestions(definition(["T1", "T2"], ["A1.2019"]), bank))).toEqual([
      "t1-a1",
      "t2-a1",
    ]);
  });

  it("returns empty when selected category has a non-matching subcategory", () => {
    expect(ids(getMatchingQuestions(definition(["T2"], ["Missing"]), bank))).toEqual([]);
  });

  it("returns empty when no category matches", () => {
    expect(ids(getMatchingQuestions(definition(["Missing"]), bank))).toEqual([]);
  });

  it("excludes questions without subcategory when subcategory filters are selected", () => {
    expect(ids(getMatchingQuestions(definition(["T1"], ["A1.2019"]), bank))).not.toContain(
      "t1-none",
    );
  });

  it("regresses T1 + A1.2019 never leaking T1/A2.2012 or T2/A2.2012", () => {
    const regressionBank = [
      question("expected", "T1", "A1.2019"),
      question("wrong-same-category", "T1", "A2.2012"),
      question("wrong-same-subcategory", "T2", "A2.2012"),
    ];

    expect(ids(getMatchingQuestions(definition(["T1"], ["A1.2019"]), regressionBank))).toEqual([
      "expected",
    ]);
  });
});

describe("calculateAttemptResult", () => {
  it("uses saved elapsed recovery time instead of wall-clock closed time", () => {
    const activeAttempt: ActiveTestAttempt = {
      id: "active-1",
      testId: "test-1",
      startedAt: "2026-06-11T10:00:00.000Z",
      savedElapsedSeconds: 125,
      originalQuestionCount: 1,
      currentQueueIndex: 0,
      draftSelections: {},
      queue: [
        {
          queueId: "q1-original",
          sourceQuestionId: "q1",
          retryNumber: 0,
          question: {
            id: "q1",
            question: "Recovered question",
            questionType: "single_choice",
            questionCategory: "T1",
            options: [{ id: "a", text: "A" }],
            correctOptions: ["a"],
          },
        },
      ],
      submittedAnswers: {
        "q1-original": {
          selectedOptionIds: ["a"],
          isCorrect: true,
          answeredAt: "2026-06-12T10:00:00.000Z",
          attemptNumber: 1,
        },
      },
    };

    const result = calculateAttemptResult(activeAttempt, definition(["T1"]));

    expect(result.durationSeconds).toBe(125);
  });

  it("applies negative marking to final score", () => {
    const attempt = activeAttempt(
      [queueItem("q1-original", "T1"), queueItem("q2-original", "T1")],
      {
        "q1-original": answer(true),
        "q2-original": answer(false),
      },
    );

    const result = calculateAttemptResult(attempt, {
      ...definition(["T1"]),
      negativeMarkingEnabled: true,
      penaltyPerIncorrectAnswer: 0.5,
    });

    expect(result.rawScore).toBe(1);
    expect(result.finalScore).toBe(0.5);
    expect(result.gradeOutOf10).toBe(2.5);
  });

  it("clamps negative grades to zero", () => {
    const attempt = activeAttempt(
      [queueItem("q1-original", "T1"), queueItem("q2-original", "T1")],
      {
        "q1-original": answer(false),
        "q2-original": answer(false),
      },
    );

    const result = calculateAttemptResult(attempt, {
      ...definition(["T1"]),
      negativeMarkingEnabled: true,
      penaltyPerIncorrectAnswer: 1,
    });

    expect(result.finalScore).toBe(-2);
    expect(result.gradeOutOf10).toBe(0);
  });

  it("clamps grades above ten", () => {
    const attempt = activeAttempt(
      [queueItem("q1-original", "T1"), queueItem("q2-original", "T1")],
      {
        "q1-original": answer(true),
        "q2-original": answer(true),
      },
      { originalQuestionCount: 1 },
    );

    const result = calculateAttemptResult(attempt, definition(["T1"]));

    expect(result.gradeOutOf10).toBe(10);
  });

  it("handles zero original questions", () => {
    const result = calculateAttemptResult(activeAttempt([], {}, { originalQuestionCount: 0 }), {
      ...definition(["T1"]),
      negativeMarkingEnabled: true,
      penaltyPerIncorrectAnswer: 1,
    });

    expect(result.totalQuestions).toBe(0);
    expect(result.accuracyPercentage).toBe(0);
    expect(result.gradeOutOf10).toBe(0);
    expect(result.categoryResults).toEqual([]);
  });

  it("tracks unanswered category results", () => {
    const result = calculateAttemptResult(
      activeAttempt([queueItem("q1-original", "T1", "A1.2019")], {}),
      definition(["T1"]),
    );

    expect(result.unansweredQuestions).toBe(1);
    expect(result.categoryResults).toEqual([
      {
        category: "T1 / A1.2019",
        correct: 0,
        incorrect: 0,
        unanswered: 1,
        total: 1,
        accuracyPercentage: 0,
      },
    ]);
  });

  it("counts retry correct and incorrect answers separately from original scoring", () => {
    const result = calculateAttemptResult(
      activeAttempt(
        [
          queueItem("q1-original", "T1"),
          queueItem("q1-retry-1", "T1", undefined, 1),
          queueItem("q2-retry-1", "T1", undefined, 1),
        ],
        {
          "q1-original": answer(false),
          "q1-retry-1": answer(true),
          "q2-retry-1": answer(false),
        },
        { originalQuestionCount: 1 },
      ),
      definition(["T1"]),
    );

    expect(result.correctAnswers).toBe(0);
    expect(result.incorrectAnswers).toBe(1);
    expect(result.retryAttempts).toBe(2);
    expect(result.retryCorrectAnswers).toBe(1);
    expect(result.retryIncorrectAnswers).toBe(1);
  });

  it("uses category labels with and without subcategories", () => {
    const result = calculateAttemptResult(
      activeAttempt([queueItem("q1-original", "T1", "A1.2019"), queueItem("q2-original", "T2")], {
        "q1-original": answer(true),
        "q2-original": answer(false),
      }),
      definition(["T1", "T2"]),
    );

    expect(result.categoryResults.map((item) => item.category)).toEqual(["T1 / A1.2019", "T2"]);
  });

  it("clamps negative saved elapsed seconds to zero", () => {
    const result = calculateAttemptResult(
      activeAttempt([queueItem("q1-original", "T1")], {}, { savedElapsedSeconds: -10 }),
      definition(["T1"]),
    );

    expect(result.durationSeconds).toBe(0);
  });
});
