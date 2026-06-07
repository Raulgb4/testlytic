import { describe, expect, it } from "vitest";
import { buildQuestionBankExportJson } from "./questionCollectionExport";
import { QuestionCollection } from "./questionCollectionTypes";
import { validateQuestionCollectionJson } from "./questionCollectionValidation";

describe("buildQuestionBankExportJson", () => {
  it("exports an import-compatible collection without runtime fields", () => {
    const collection: QuestionCollection = {
      version: "1",
      importedAt: "2026-06-05T12:00:00.000Z",
      summary: {
        totalQuestions: 1,
        totalCategories: 1,
        totalSubcategories: 1,
        totalSingleChoice: 1,
        totalMultipleChoice: 0,
        totalSources: 1,
      },
      questions: [
        {
          id: "q-001",
          question: "Which metric best tracks study consistency over time?",
          auxiliaryInformation: "Pick the most representative analytics metric.",
          questionType: "single_choice",
          options: [
            { id: "a", text: "Maximum single score" },
            { id: "b", text: "Average score across completed tests" },
          ],
          correctOptions: ["b"],
          correctAnswerExplanation: "Average score is stable over time.",
          questionCategory: "Analytics",
          questionSubcategory: "Core Metrics",
          questionSource: "Template",
          analytics: {
            computedDifficulty: "medium",
            userDeclaredDifficulty: "low",
            timesAnsweredIncorrectly: 2,
            timesAnsweredCorrectly: 4,
          },
        },
      ],
    };

    const json = buildQuestionBankExportJson(collection);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed).toEqual({
      version: "1",
      questions: [
        {
          id: "q-001",
          question: "Which metric best tracks study consistency over time?",
          auxiliaryInformation: "Pick the most representative analytics metric.",
          questionType: "single_choice",
          options: [
            { id: "a", text: "Maximum single score" },
            { id: "b", text: "Average score across completed tests" },
          ],
          correctOptions: ["b"],
          correctAnswerExplanation: "Average score is stable over time.",
          questionCategory: "Analytics",
          questionSubcategory: "Core Metrics",
          questionSource: "Template",
        },
      ],
    });
    expect(parsed).not.toHaveProperty("importedAt");
    expect(parsed).not.toHaveProperty("summary");
    expect((parsed.questions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("analytics");

    const validation = validateQuestionCollectionJson(json);
    expect(validation.ok).toBe(true);
  });
});
