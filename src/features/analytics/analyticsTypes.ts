export type AnalyticsTab = "dashboard" | "history";
export type HistoryStatus = "correct" | "incorrect" | "unanswered";

export type MockCompletedAttempt = {
  id: string;
  date: string;
  title: string;
  topic: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  scorePercent: number;
};

export type MockAnswerHistoryRow = {
  id: string;
  attemptId: string;
  date: string;
  testTitle: string;
  topic: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  result: HistoryStatus;
};
