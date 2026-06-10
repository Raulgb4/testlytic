export type ImportedQuestionCollection = {
  version: "1";
  questions: ImportedQuestion[];
};

export type ImportedQuestion = {
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
  exposureCount: number;
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
  severity: "error" | "warning";
  path: string;
  message: string;
  code: string;
  questionIndex?: number;
  optionIndex?: number;
};

export type ValidationResult =
  | { ok: true; collection: QuestionCollection; warnings: ValidationIssue[] }
  | {
      ok: false;
      errors: ValidationIssue[];
      warnings: ValidationIssue[];
      errorLimitReached: boolean;
    };
