import { MockQuestion } from "./testTypes";

export type ImportedQuestionCollection = {
  version: "1";
  questions: ImportedQuestion[];
};

export type ImportedQuestion = {
  id: string;
  question: string;
  auxiliaryInformation?: string;
  questionType: "single_choice" | "multiple_choice";
  options: { id: string; text: string }[];
  correctOptions: string[];
  correctAnswerExplanation?: string;
  questionCategory: string;
  questionSubcategory?: string;
  questionSource?: string;
};

export type DifficultyLevel = "unrated" | "easy" | "medium" | "hard";

export type QuestionAnalytics = {
  computedDifficulty: DifficultyLevel;
  userDeclaredDifficulty: DifficultyLevel;
  timesAnsweredIncorrectly: number;
  timesAnsweredCorrectly: number;
};

export type CollectionQuestion = {
  id: string;
  question: string;
  auxiliaryInformation?: string;
  questionType: "single_choice" | "multiple_choice";
  options: { id: string; text: string }[];
  correctOptions: string[];
  correctAnswerExplanation?: string;
  questionCategory: string;
  questionSubcategory?: string;
  questionSource?: string;
  analytics: QuestionAnalytics;
};

export type QuestionCollectionSummary = {
  totalQuestions: number;
  totalCategories: number;
  totalSubcategories: number;
  totalSingleChoice: number;
  totalMultipleChoice: number;
  totalSources: number;
};

export type QuestionCollection = {
  version: "1";
  importedAt: string;
  questions: CollectionQuestion[];
  summary: QuestionCollectionSummary;
};

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; collection: QuestionCollection }
  | { ok: false; errors: ValidationIssue[] };

export function mapCollectionToSessionQuestions(collection: QuestionCollection): MockQuestion[] {
  return collection.questions.map((question) => ({
    id: question.id,
    statement: question.question,
    topic: question.questionCategory,
    category: question.questionSubcategory || "General",
    options: question.options,
    correctOptionId: question.correctOptions[0] || "",
    explanation: question.correctAnswerExplanation || "No explanation provided.",
  }));
}
