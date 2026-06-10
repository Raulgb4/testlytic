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
            exposureCount: 0,
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
    expect((parsed.questions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("id");
    expect((parsed.questions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("analytics");

    const validation = validateQuestionCollectionJson(json);
    expect(validation.ok).toBe(true);
  });

  it("validates question collections without user-facing question IDs", () => {
    const json = JSON.stringify({
      version: "1",
      questions: [
        {
          question: "Which score is shown after finishing a test?",
          questionType: "single_choice",
          options: [
            { id: "a", text: "Final score" },
            { id: "b", text: "Pending score" },
          ],
          correctOptions: ["a"],
          questionCategory: "Scoring",
        },
      ],
    });

    const firstValidation = validateQuestionCollectionJson(json);
    const secondValidation = validateQuestionCollectionJson(json);

    expect(firstValidation.ok).toBe(true);
    expect(secondValidation.ok).toBe(true);
    if (!firstValidation.ok || !secondValidation.ok) return;

    expect(firstValidation.collection.questions[0].id).toBeTruthy();
    expect(firstValidation.collection.questions[0].id).toBe(
      secondValidation.collection.questions[0].id,
    );
  });

  it("accepts legacy question IDs but ignores them when generating internal IDs", () => {
    const json = JSON.stringify({
      version: "1",
      questions: [
        {
          id: "legacy-id",
          question: "Which data remains local?",
          questionType: "single_choice",
          options: [
            { id: "a", text: "Question bank" },
            { id: "b", text: "Cloud sync" },
          ],
          correctOptions: ["a"],
          questionCategory: "Privacy",
        },
        {
          id: "legacy-id",
          question: "Which data remains local?",
          questionType: "single_choice",
          options: [
            { id: "a", text: "Question bank" },
            { id: "b", text: "Cloud sync" },
          ],
          correctOptions: ["a"],
          questionCategory: "Privacy",
        },
      ],
    });

    const validation = validateQuestionCollectionJson(json);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const [firstQuestion, secondQuestion] = validation.collection.questions;
    expect(firstQuestion.id).not.toBe("legacy-id");
    expect(secondQuestion.id).not.toBe("legacy-id");
    expect(firstQuestion.id).not.toBe(secondQuestion.id);
  });

  it("reports malformed JSON with a friendly parse error", () => {
    const validation = validateQuestionCollectionJson('{ "version": "1", "questions": [ }');

    expect(validation.ok).toBe(false);
    if (validation.ok) return;

    expect(validation.errors[0]).toMatchObject({
      severity: "error",
      path: "root",
      code: "json.invalid",
    });
    expect(validation.errors[0].message).toContain("Invalid JSON format");
  });

  it("reports strict schema errors with question and option indexes", () => {
    const validation = validateQuestionCollectionJson(
      JSON.stringify({
        version: "1",
        questions: [
          {
            question: " ",
            questionType: "single_choice",
            options: [
              { id: "a", text: "First" },
              { id: "a", text: "Duplicate ID" },
            ],
            correctOptions: ["a", "a", "missing"],
            questionCategory: "Scoring",
          },
        ],
      }),
    );

    expect(validation.ok).toBe(false);
    if (validation.ok) return;

    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "question.required", questionIndex: 0 }),
        expect.objectContaining({ code: "option.idDuplicate", questionIndex: 0, optionIndex: 1 }),
        expect.objectContaining({ code: "correctOptions.duplicate", questionIndex: 0 }),
        expect.objectContaining({ code: "correctOptions.referenceMissing", questionIndex: 0 }),
      ]),
    );
  });

  it("caps validation errors for large invalid files", () => {
    const questions = Array.from({ length: 150 }, () => ({
      question: "",
      questionType: "single_choice",
      options: [],
      correctOptions: [],
      questionCategory: "",
    }));

    const validation = validateQuestionCollectionJson(JSON.stringify({ version: "1", questions }));

    expect(validation.ok).toBe(false);
    if (validation.ok) return;

    expect(validation.errors).toHaveLength(100);
    expect(validation.errorLimitReached).toBe(true);
  });

  it("validates a large generated question bank fixture", () => {
    const questions = Array.from({ length: 2500 }, (_, index) => ({
      question: `Generated question ${index + 1}?`,
      questionType: "single_choice",
      options: [
        { id: "a", text: "Correct option" },
        { id: "b", text: "Incorrect option" },
        { id: "c", text: "Distractor option" },
      ],
      correctOptions: ["a"],
      correctAnswerExplanation: "Generated explanation.",
      questionCategory: `Category ${index % 10}`,
      questionSubcategory: `Subcategory ${index % 25}`,
      questionSource: "Generated fixture",
    }));

    const validation = validateQuestionCollectionJson(JSON.stringify({ version: "1", questions }));

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.collection.questions).toHaveLength(2500);
    expect(validation.collection.summary.totalCategories).toBe(10);
    expect(validation.collection.summary.totalSubcategories).toBe(25);
  });
});
