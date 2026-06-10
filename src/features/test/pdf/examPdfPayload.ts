import { RuntimeQuestion, TestDefinition } from "../testTypes";
import { ExamPdfPayload } from "./examPdfTypes";
import { getCorrectOptionLabels } from "./pdfLayoutUtils";

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function summarizeList(values: string[]) {
  if (values.length === 0) return "All";
  if (values.length <= 4) return values.join(", ");
  return `${values.slice(0, 4).join(", ")} +${values.length - 4} more`;
}

export function buildExamPdfPayload({
  definition,
  runtimeQuestions,
  generatedAt,
}: {
  definition: TestDefinition;
  runtimeQuestions: RuntimeQuestion[];
  generatedAt: string;
}): ExamPdfPayload {
  const questions = runtimeQuestions.map((question, index) => ({ ...question, number: index + 1 }));
  const categories = uniqueSorted(runtimeQuestions.map((question) => question.questionCategory));
  const subcategories = uniqueSorted(
    runtimeQuestions.map((question) => question.questionSubcategory),
  );
  const effectiveTimeLimit = definition.timeLimitEnabled ? definition.timeLimitMinutes : 0;

  return {
    definition,
    generatedAt,
    questions,
    maxOptionCount: Math.max(4, ...runtimeQuestions.map((question) => question.options.length)),
    answerKey: questions.map((question) => ({
      questionNumber: question.number,
      correctLabels: getCorrectOptionLabels(question),
    })),
    metadata: {
      generatedAt,
      questionCount: runtimeQuestions.length,
      categorySummary: summarizeList(categories),
      subcategorySummary: subcategories.length > 0 ? summarizeList(subcategories) : "None",
      timeLimit: effectiveTimeLimit > 0 ? `${effectiveTimeLimit} minutes` : "No time limit",
      negativeMarking: definition.negativeMarkingEnabled
        ? `Penalty ${definition.penaltyPerIncorrectAnswer} per incorrect answer`
        : "Disabled",
      allowUnanswered: definition.allowUnanswered ? "Yes" : "No",
    },
  };
}
