import { CollectionQuestion } from "../questionCollectionTypes";
import { TestDefinition } from "../testTypes";
import { getMatchingQuestions } from "../testUtils";

export type TestFormState = {
  title: string;
  questionLimit: number;
  includedCategories: string[];
  includedSubcategories: string[];
  allowUnanswered: boolean;
  timeLimitEnabled: boolean;
  negativeMarkingEnabled: boolean;
  penaltyPerIncorrectAnswer: number;
  timeLimitMinutes: number;
};

export type TestDefinitionFormValidation = {
  errors: {
    title?: string;
    questionLimit?: string;
    includedCategories?: string;
    timeLimitMinutes?: string;
    penaltyPerIncorrectAnswer?: string;
  };
  summary: string[];
  matchingCount: number;
  limitWarning: string;
  order: readonly [
    "title",
    "questionLimit",
    "includedCategories",
    "timeLimitMinutes",
    "penaltyPerIncorrectAnswer",
  ];
};

export const INITIAL_FORM: TestFormState = {
  title: "",
  questionLimit: 20,
  includedCategories: [],
  includedSubcategories: [],
  allowUnanswered: true,
  timeLimitEnabled: false,
  negativeMarkingEnabled: false,
  penaltyPerIncorrectAnswer: 0.25,
  timeLimitMinutes: 30,
};

export function isSameStringList(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

export function validateDefinitionForm(
  form: TestFormState,
  bankQuestions: CollectionQuestion[],
): TestDefinitionFormValidation {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!Number.isInteger(form.questionLimit) || form.questionLimit < 1) {
    errors.questionLimit = "Question limit must be at least 1.";
  }
  if (form.includedCategories.length === 0) {
    errors.includedCategories = "Select at least one category.";
  }
  if (form.timeLimitEnabled && form.timeLimitMinutes < 1) {
    errors.timeLimitMinutes = "Time limit must be at least 1 minute.";
  }
  if (form.negativeMarkingEnabled && form.penaltyPerIncorrectAnswer < 0) {
    errors.penaltyPerIncorrectAnswer = "Penalty cannot be negative.";
  }

  const testDefinition: TestDefinition = {
    id: "temp-id",
    title: form.title,
    questionLimit: form.questionLimit,
    includedCategories: form.includedCategories,
    includedSubcategories: form.includedSubcategories,
    allowUnanswered: form.allowUnanswered,
    timeLimitEnabled: form.timeLimitEnabled,
    negativeMarkingEnabled: form.negativeMarkingEnabled,
    penaltyPerIncorrectAnswer: form.penaltyPerIncorrectAnswer,
    timeLimitMinutes: form.timeLimitEnabled ? form.timeLimitMinutes : 0,
    createdAt: "",
    updatedAt: "",
  };
  const matchingCount = getMatchingQuestions(testDefinition, bankQuestions).length;
  if (matchingCount < 1) errors.includedCategories = "No questions match your filters.";

  const summary = Object.values(errors);
  const limitWarning =
    matchingCount > 0 && form.questionLimit > matchingCount
      ? `Only ${matchingCount} matching questions are currently available.`
      : "";

  return {
    errors: {
      title: errors.title,
      questionLimit: errors.questionLimit,
      includedCategories: errors.includedCategories,
      timeLimitMinutes: errors.timeLimitMinutes,
      penaltyPerIncorrectAnswer: errors.penaltyPerIncorrectAnswer,
    },
    summary,
    matchingCount,
    limitWarning,
    order: [
      "title",
      "questionLimit",
      "includedCategories",
      "timeLimitMinutes",
      "penaltyPerIncorrectAnswer",
    ] as const,
  };
}
