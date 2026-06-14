import { describe, expect, it } from "vitest";
import {
  getCollectionValidationErrorPreview,
  validateQuestionCollectionJson,
} from "./questionCollectionValidation";

function validQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question: "Which answer is correct?",
    questionType: "single_choice",
    options: [
      { id: "a", text: "Correct" },
      { id: "b", text: "Incorrect" },
    ],
    correctOptions: ["a"],
    questionCategory: "Validation",
    ...overrides,
  };
}

function validateQuestion(overrides: Record<string, unknown>) {
  return validateQuestionCollectionJson(
    JSON.stringify({ version: "1", questions: [validQuestion(overrides)] }),
  );
}

function expectErrorCodes(
  result: ReturnType<typeof validateQuestionCollectionJson>,
  codes: string[],
) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining(codes));
}

describe("validateQuestionCollectionJson", () => {
  it.each([
    ["null", null],
    ["array", []],
    ["string", "not a bank"],
  ])("rejects %s root payloads", (_label, payload) => {
    const validation = validateQuestionCollectionJson(JSON.stringify(payload));

    expectErrorCodes(validation, ["root.type"]);
  });

  it.each([
    ["missing version", { questions: [validQuestion()] }],
    ["bad version", { version: "2", questions: [validQuestion()] }],
  ])("rejects %s", (_label, payload) => {
    const validation = validateQuestionCollectionJson(JSON.stringify(payload));

    expectErrorCodes(validation, ["version.invalid"]);
  });

  it.each([
    ["missing questions", { version: "1" }],
    ["non-array questions", { version: "1", questions: {} }],
    ["empty questions", { version: "1", questions: [] }],
  ])("rejects %s", (_label, payload) => {
    const validation = validateQuestionCollectionJson(JSON.stringify(payload));

    expectErrorCodes(validation, ["questions.invalid"]);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "bad question"],
  ])("rejects %s question entries", (_label, question) => {
    const validation = validateQuestionCollectionJson(
      JSON.stringify({ version: "1", questions: [question] }),
    );

    expectErrorCodes(validation, ["question.type"]);
  });

  it("rejects non-string required fields", () => {
    const validation = validateQuestion({
      question: 123,
      questionType: "unsupported",
      questionCategory: false,
    });

    expectErrorCodes(validation, [
      "question.required",
      "questionType.invalid",
      "category.required",
    ]);
  });

  it("reports optional field type errors", () => {
    const validation = validateQuestion({
      auxiliaryInformation: 1,
      correctAnswerExplanation: false,
      questionSubcategory: [],
      questionSource: {},
    });

    expectErrorCodes(validation, [
      "auxiliaryInformation.type",
      "correctAnswerExplanation.type",
      "subcategory.type",
      "source.type",
    ]);
  });

  it("reports malformed option entries", () => {
    const validation = validateQuestion({
      options: [
        null,
        { id: 1, text: "Non-string id" },
        { id: "empty-text", text: " " },
        { id: "dup", text: "First duplicate" },
        { id: "dup", text: "Second duplicate" },
      ],
      correctOptions: ["dup"],
    });

    expectErrorCodes(validation, [
      "option.type",
      "option.idRequired",
      "option.textRequired",
      "option.idDuplicate",
    ]);
  });

  it("rejects non-string option text", () => {
    const validation = validateQuestion({
      options: [
        { id: "a", text: 42 },
        { id: "b", text: "Valid" },
      ],
      correctOptions: ["b"],
    });

    expectErrorCodes(validation, ["option.textRequired"]);
  });

  it.each([
    ["not array", "a", ["correctOptions.invalid"]],
    ["empty array", [], ["correctOptions.invalid", "singleChoice.correctCount"]],
    ["non-string value", [1], ["correctOptions.valueRequired"]],
    ["empty value", [" "], ["correctOptions.valueRequired"]],
    ["invalid reference", ["missing"], ["correctOptions.referenceMissing"]],
  ])("reports invalid correctOptions: %s", (_label, correctOptions, codes) => {
    const validation = validateQuestion({ correctOptions });

    expectErrorCodes(validation, codes);
  });

  it("rejects single-choice questions with multiple correct answers", () => {
    const validation = validateQuestion({ correctOptions: ["a", "b"] });

    expectErrorCodes(validation, ["singleChoice.correctCount"]);
  });
});

describe("getCollectionValidationErrorPreview", () => {
  it("returns a limited error preview and clamps the limit to at least one", () => {
    const errors = [
      { severity: "error" as const, path: "a", code: "a", message: "A" },
      { severity: "error" as const, path: "b", code: "b", message: "B" },
      { severity: "error" as const, path: "c", code: "c", message: "C" },
    ];

    expect(getCollectionValidationErrorPreview(errors, 2)).toEqual(errors.slice(0, 2));
    expect(getCollectionValidationErrorPreview(errors, 0)).toEqual(errors.slice(0, 1));
  });
});
