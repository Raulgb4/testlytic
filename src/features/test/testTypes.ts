export type QuestionOption = {
  id: string;
  text: string;
};

export type RuntimeQuestion = {
  id: string;
  question: string;
  auxiliaryInformation?: string;
  questionType: "single_choice" | "multiple_choice";
  questionCategory: string;
  questionSubcategory?: string;
  options: QuestionOption[];
  correctOptions: string[];
  correctAnswerExplanation?: string;
};

export type TestDefinition = {
  id: string;
  title: string;
  questionLimit: number;
  includedCategories: string[];
  includedSubcategories?: string[];
  allowUnanswered: boolean;
  negativeMarkingEnabled: boolean;
  penaltyPerIncorrectAnswer: number;
  timeLimitMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeAnswer = {
  selectedOptionIds: string[];
  isCorrect: boolean;
  answeredAt: string;
  attemptNumber: number;
};

export type RuntimeQueueItem = {
  queueId: string;
  sourceQuestionId: string;
  retryNumber: number;
  question: RuntimeQuestion;
};

export type ActiveTestAttempt = {
  id: string;
  testId: string;
  startedAt: string;
  queue: RuntimeQueueItem[];
  originalQuestionCount: number;
  submittedAnswers: Record<string, RuntimeAnswer | undefined>;
  draftSelections: Record<string, string[] | undefined>;
  currentQueueIndex: number;
};

export type TestAttempt = {
  id: string;
  testId: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  rawScore: number;
  finalScore: number;
  accuracyPercentage: number;
};
