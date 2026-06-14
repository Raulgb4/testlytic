import { describe, expect, it } from "vitest";
import { CollectionQuestion } from "../questionCollectionTypes";
import { INITIAL_FORM, isSameStringList, validateDefinitionForm } from "./testDefinitionForm";

const analytics: CollectionQuestion["analytics"] = {
  computedDifficulty: "unrated",
  userDeclaredDifficulty: "unrated",
  timesAnsweredIncorrectly: 0,
  timesAnsweredCorrectly: 0,
  exposureCount: 0,
};

const question: CollectionQuestion = {
  id: "q1",
  question: "Question 1",
  questionType: "single_choice",
  options: [{ id: "a", text: "A" }],
  correctOptions: ["a"],
  shuffleOptions: true,
  questionCategory: "T1",
  questionSubcategory: "A1",
  analytics,
};

describe("testDefinitionForm", () => {
  it("validates required fields and no matching questions", () => {
    const validation = validateDefinitionForm(INITIAL_FORM, [question]);

    expect(validation.errors.title).toBe("Title is required.");
    expect(validation.errors.includedCategories).toBe("No questions match your filters.");
    expect(validation.matchingCount).toBe(0);
  });

  it("returns matching count and limit warning for valid filters", () => {
    const validation = validateDefinitionForm(
      { ...INITIAL_FORM, title: "Practice", questionLimit: 2, includedCategories: ["T1"] },
      [question],
    );

    expect(validation.summary).toEqual([]);
    expect(validation.matchingCount).toBe(1);
    expect(validation.limitWarning).toBe("Only 1 matching questions are currently available.");
  });

  it("compares string lists by value and order", () => {
    expect(isSameStringList(["T1", "T2"], ["T1", "T2"])).toBe(true);
    expect(isSameStringList(["T2", "T1"], ["T1", "T2"])).toBe(false);
    expect(isSameStringList(["T1"], ["T1", "T2"])).toBe(false);
  });
});
