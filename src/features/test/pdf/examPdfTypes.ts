import { RuntimeQuestion, TestDefinition } from "../testTypes";

export type ExamPdfQuestion = RuntimeQuestion & {
  number: number;
};

export type ExamPdfMetadata = {
  generatedAt: string;
  questionCount: number;
  categorySummary: string;
  subcategorySummary: string;
  timeLimit: string;
  negativeMarking: string;
  allowUnanswered: string;
};

export type ExamPdfAnswerKeyItem = {
  questionNumber: number;
  correctLabels: string[];
};

export type ExamPdfPayload = {
  definition: TestDefinition;
  generatedAt: string;
  questions: ExamPdfQuestion[];
  metadata: ExamPdfMetadata;
  answerKey: ExamPdfAnswerKeyItem[];
  maxOptionCount: number;
};
