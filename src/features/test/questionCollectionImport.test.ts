import { describe, expect, it } from "vitest";
import {
  buildUpdatedQuestionCollection,
  findDuplicateQuestions,
  importQuestionsAsCopies,
  replaceExistingQuestions,
} from "./questionCollectionImport";
import {
  CollectionQuestion,
  QuestionAnalytics,
  QuestionCollection,
} from "./questionCollectionTypes";

const analytics: QuestionAnalytics = {
  computedDifficulty: "medium",
  userDeclaredDifficulty: "high",
  timesAnsweredIncorrectly: 3,
  timesAnsweredCorrectly: 5,
  exposureCount: 8,
};

function question(overrides: Partial<CollectionQuestion> = {}): CollectionQuestion {
  return {
    id: "q_existing",
    question: "Which answer is correct?",
    questionType: "single_choice",
    options: [
      { id: "a", text: "Correct" },
      { id: "b", text: "Incorrect" },
    ],
    correctOptions: ["a"],
    shuffleOptions: true,
    questionCategory: "Import",
    analytics: { ...analytics },
    ...overrides,
  };
}

describe("question collection import helpers", () => {
  it("detects duplicates by normalized content fingerprint", () => {
    const existing = question({ question: "  Same   prompt?  " });
    const incoming = question({ id: "incoming-id", question: "Same prompt?" });

    const duplicates = findDuplicateQuestions([existing], [incoming]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({ question: "Same prompt?" });
    expect(duplicates[0].fingerprint).toBeTruthy();
  });

  it("imports duplicate content as copies with new internal IDs", () => {
    const existing = question({ id: "q_existing" });
    const incoming = question({ id: "q_existing" });

    const imported = importQuestionsAsCopies([existing], [incoming]);

    expect(imported).toHaveLength(2);
    expect(imported[0]).toBe(existing);
    expect(imported[1].id).not.toBe("q_existing");
    expect(imported[1].question).toBe(incoming.question);
  });

  it("replaces existing duplicate content while preserving internal ID and analytics", () => {
    const existing = question({
      id: "stable-id",
      question: "Same prompt?",
      analytics,
    });
    const incoming = question({
      id: "incoming-id",
      question: "Same prompt?",
      analytics: {
        computedDifficulty: "unrated",
        userDeclaredDifficulty: "unrated",
        timesAnsweredIncorrectly: 0,
        timesAnsweredCorrectly: 0,
        exposureCount: 0,
      },
    });

    const replaced = replaceExistingQuestions([existing], [incoming]);

    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({
      id: "stable-id",
      analytics,
    });
    expect(replaced[0]).not.toBe(existing);
  });

  it("appends non-duplicate incoming questions during replace", () => {
    const existing = question({ id: "q1", question: "Existing?" });
    const incoming = question({ id: "q2", question: "New question?" });

    const replaced = replaceExistingQuestions([existing], [incoming]);

    expect(replaced.map((item) => item.question)).toEqual(["Existing?", "New question?"]);
    expect(new Set(replaced.map((item) => item.id)).size).toBe(2);
  });

  it("rebuilds collection metadata and summary", () => {
    const current: QuestionCollection = {
      version: "1",
      importedAt: "2026-06-01T00:00:00.000Z",
      questions: [],
      summary: {
        totalQuestions: 0,
        totalCategories: 0,
        totalSubcategories: 0,
        totalSingleChoice: 0,
        totalMultipleChoice: 0,
        totalSources: 0,
      },
    };

    const updated = buildUpdatedQuestionCollection(current, [
      question({ questionCategory: "A", questionSubcategory: "A1", questionSource: "Source" }),
      question({ id: "q2", questionType: "multiple_choice", questionCategory: "B" }),
    ]);

    expect(updated.version).toBe("1");
    expect(updated.importedAt).not.toBe(current.importedAt);
    expect(updated.summary).toMatchObject({
      totalQuestions: 2,
      totalCategories: 2,
      totalSubcategories: 1,
      totalSingleChoice: 1,
      totalMultipleChoice: 1,
      totalSources: 1,
    });
  });
});
