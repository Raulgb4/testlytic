export type QuestionOption = {
  id: string;
  text: string;
};

export type MockQuestion = {
  id: string;
  statement: string;
  topic: string;
  category: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
};

export type TestFlowStatus = "landing" | "configure" | "active" | "results";

export type TestConfig = {
  title: string;
  topicCategory: string;
  questionCount: number;
  timeLimitMinutes: number;
  negativeMarking: boolean;
  negativeMarkingValue: number;
  allowUnanswered: boolean;
};

export type TestResult = {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
};
