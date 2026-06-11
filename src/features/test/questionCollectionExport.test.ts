import { describe, expect, it } from "vitest";
import { buildQuestionBankExportJson } from "./questionCollectionExport";
import { QuestionCollection } from "./questionCollectionTypes";
import { validateQuestionCollectionJson } from "./questionCollectionValidation";
import { buildRuntimeOptions, buildRuntimeQuestions } from "./testUtils";
import { getCorrectOptionLabels } from "./pdf/pdfLayoutUtils";

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
          shuffleOptions: false,
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
          shuffleOptions: false,
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

  it("roundtrips import/export across multiple categories and subcategories", () => {
    const sourceJson = JSON.stringify({
      version: "1",
      questions: [
        {
          question: "Question T1 A1",
          questionType: "single_choice",
          options: [
            { id: "a", text: "Correct" },
            { id: "b", text: "Wrong" },
          ],
          correctOptions: ["a"],
          shuffleOptions: false,
          questionCategory: "T1",
          questionSubcategory: "A1.2019",
        },
        {
          question: "Question T2 A2",
          questionType: "multiple_choice",
          options: [
            { id: "a", text: "Correct A" },
            { id: "b", text: "Correct B" },
            { id: "c", text: "Wrong" },
          ],
          correctOptions: ["a", "b"],
          questionCategory: "T2",
          questionSubcategory: "A2.2012",
        },
      ],
    });

    const firstImport = validateQuestionCollectionJson(sourceJson);
    expect(firstImport.ok).toBe(true);
    if (!firstImport.ok) return;

    const exported = buildQuestionBankExportJson(firstImport.collection);
    const secondImport = validateQuestionCollectionJson(exported);
    expect(secondImport.ok).toBe(true);
    if (!secondImport.ok) return;

    expect(secondImport.collection.summary).toMatchObject({
      totalQuestions: 2,
      totalCategories: 2,
      totalSubcategories: 2,
      totalSingleChoice: 1,
      totalMultipleChoice: 1,
    });
    expect(
      secondImport.collection.questions.map((question) => ({
        question: question.question,
        category: question.questionCategory,
        subcategory: question.questionSubcategory,
        correctOptions: question.correctOptions,
        shuffleOptions: question.shuffleOptions,
      })),
    ).toEqual([
      {
        question: "Question T1 A1",
        category: "T1",
        subcategory: "A1.2019",
        correctOptions: ["a"],
        shuffleOptions: false,
      },
      {
        question: "Question T2 A2",
        category: "T2",
        subcategory: "A2.2012",
        correctOptions: ["a", "b"],
        shuffleOptions: true,
      },
    ]);
  });

  it("excludes internal IDs and analytics from exported bank JSON", () => {
    const collection: QuestionCollection = {
      version: "1",
      importedAt: "2026-06-11T12:00:00.000Z",
      summary: {
        totalQuestions: 1,
        totalCategories: 1,
        totalSubcategories: 0,
        totalSingleChoice: 1,
        totalMultipleChoice: 0,
        totalSources: 0,
      },
      questions: [
        {
          id: "internal-id",
          question: "Internal fields?",
          questionType: "single_choice",
          options: [
            { id: "a", text: "Excluded" },
            { id: "b", text: "Included" },
          ],
          correctOptions: ["b"],
          shuffleOptions: true,
          questionCategory: "Export",
          analytics: {
            computedDifficulty: "high",
            userDeclaredDifficulty: "medium",
            timesAnsweredIncorrectly: 5,
            timesAnsweredCorrectly: 2,
            exposureCount: 7,
          },
        },
      ],
    };

    const parsed = JSON.parse(buildQuestionBankExportJson(collection));

    expect(parsed).not.toHaveProperty("importedAt");
    expect(parsed).not.toHaveProperty("summary");
    expect(parsed.questions[0]).not.toHaveProperty("id");
    expect(parsed.questions[0]).not.toHaveProperty("analytics");
    expect(JSON.stringify(parsed)).not.toContain("internal-id");
    expect(JSON.stringify(parsed)).not.toContain("exposureCount");
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
    expect(firstValidation.collection.questions[0].shuffleOptions).toBe(true);
    expect(firstValidation.collection.questions[0].id).toBe(
      secondValidation.collection.questions[0].id,
    );
  });

  it("validates explicit shuffleOptions true and false values", () => {
    const buildJson = (shuffleOptions: boolean) =>
      JSON.stringify({
        version: "1",
        questions: [
          {
            question: "Should options be shuffled?",
            questionType: "single_choice",
            options: [
              { id: "a", text: "Yes" },
              { id: "b", text: "No" },
            ],
            correctOptions: ["a"],
            shuffleOptions,
            questionCategory: "Behavior",
          },
        ],
      });

    const shuffled = validateQuestionCollectionJson(buildJson(true));
    const fixed = validateQuestionCollectionJson(buildJson(false));

    expect(shuffled.ok).toBe(true);
    expect(fixed.ok).toBe(true);
    if (!shuffled.ok || !fixed.ok) return;

    expect(shuffled.collection.questions[0].shuffleOptions).toBe(true);
    expect(fixed.collection.questions[0].shuffleOptions).toBe(false);
  });

  it("rejects non-boolean shuffleOptions values", () => {
    const buildJson = (shuffleOptions: unknown) =>
      JSON.stringify({
        version: "1",
        questions: [
          {
            question: "Invalid shuffle setting?",
            questionType: "single_choice",
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
            correctOptions: ["a"],
            shuffleOptions,
            questionCategory: "Behavior",
          },
        ],
      });

    for (const value of ["false", 0]) {
      const validation = validateQuestionCollectionJson(buildJson(value));
      expect(validation.ok).toBe(false);
      if (validation.ok) continue;
      expect(validation.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "shuffleOptions.type" })]),
      );
    }
  });

  it("preserves option order at runtime when shuffleOptions is false", () => {
    const options = [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "Both a and b" },
    ];

    const runtimeOptions = buildRuntimeOptions({
      id: "q-fixed",
      question: "Which answer references previous options?",
      questionType: "single_choice",
      options,
      correctOptions: ["c"],
      shuffleOptions: false,
      questionCategory: "Behavior",
      analytics: {
        computedDifficulty: "unrated",
        userDeclaredDifficulty: "unrated",
        timesAnsweredIncorrectly: 0,
        timesAnsweredCorrectly: 0,
        exposureCount: 0,
      },
    });

    expect(runtimeOptions).toEqual(options);
    expect(runtimeOptions).not.toBe(options);
  });

  it("preserves shuffleOptions false through import, export, and runtime question building", () => {
    const imported = validateQuestionCollectionJson(
      JSON.stringify({
        version: "1",
        questions: [
          {
            question: "Fixed order?",
            questionType: "single_choice",
            options: [
              { id: "a", text: "First" },
              { id: "b", text: "Second" },
              { id: "c", text: "Third" },
            ],
            correctOptions: ["c"],
            shuffleOptions: false,
            questionCategory: "Runtime",
          },
        ],
      }),
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const exported = validateQuestionCollectionJson(
      buildQuestionBankExportJson(imported.collection),
    );
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const runtimeQuestions = buildRuntimeQuestions(
      {
        id: "test-1",
        title: "Runtime",
        questionLimit: 1,
        includedCategories: ["Runtime"],
        allowUnanswered: false,
        negativeMarkingEnabled: false,
        penaltyPerIncorrectAnswer: 0,
        timeLimitMinutes: 0,
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
      exported.collection.questions,
    );

    expect(exported.collection.questions[0].shuffleOptions).toBe(false);
    expect(runtimeQuestions[0].shuffleOptions).toBe(false);
    expect(runtimeQuestions[0].options.map((option) => option.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps correct option IDs valid after runtime option shuffling", () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const runtimeQuestions = buildRuntimeQuestions(
        {
          id: "test-1",
          title: "Runtime",
          questionLimit: 1,
          includedCategories: ["Runtime"],
          allowUnanswered: false,
          negativeMarkingEnabled: false,
          penaltyPerIncorrectAnswer: 0,
          timeLimitMinutes: 0,
          createdAt: "2026-06-11T00:00:00.000Z",
          updatedAt: "2026-06-11T00:00:00.000Z",
        },
        [
          {
            id: "q-shuffle",
            question: "Which option is correct?",
            questionType: "single_choice",
            options: [
              { id: "a", text: "Wrong A" },
              { id: "b", text: "Correct B" },
              { id: "c", text: "Wrong C" },
            ],
            correctOptions: ["b"],
            shuffleOptions: true,
            questionCategory: "Runtime",
            analytics: {
              computedDifficulty: "unrated",
              userDeclaredDifficulty: "unrated",
              timesAnsweredIncorrectly: 0,
              timesAnsweredCorrectly: 0,
              exposureCount: 0,
            },
          },
        ],
      );

      const optionIds = new Set(runtimeQuestions[0].options.map((option) => option.id));
      expect(runtimeQuestions[0].options.map((option) => option.id)).not.toEqual(["a", "b", "c"]);
      expect(runtimeQuestions[0].correctOptions.every((optionId) => optionIds.has(optionId))).toBe(
        true,
      );
      expect(getCorrectOptionLabels(runtimeQuestions[0])).toEqual(["A"]);
    } finally {
      Math.random = originalRandom;
    }
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
