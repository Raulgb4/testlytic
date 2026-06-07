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

export type DifficultyLevel = "unrated" | "low" | "medium" | "high";

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
