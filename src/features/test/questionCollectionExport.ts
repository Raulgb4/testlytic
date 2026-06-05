import {
  ImportedQuestion,
  ImportedQuestionCollection,
  QuestionCollection,
} from "./questionCollectionTypes";
import { saveJsonFile } from "./questionCollectionTemplate";

export const QUESTION_BANK_EXPORT_FILE_NAME = "testlytic-question-bank.json";

function toExportQuestion(question: QuestionCollection["questions"][number]): ImportedQuestion {
  return {
    id: question.id,
    question: question.question,
    auxiliaryInformation: question.auxiliaryInformation,
    questionType: question.questionType,
    options: question.options.map((option) => ({ id: option.id, text: option.text })),
    correctOptions: [...question.correctOptions],
    correctAnswerExplanation: question.correctAnswerExplanation,
    questionCategory: question.questionCategory,
    questionSubcategory: question.questionSubcategory,
    questionSource: question.questionSource,
  };
}

export function buildQuestionBankExportJson(collection: QuestionCollection) {
  const payload: ImportedQuestionCollection = {
    version: collection.version,
    questions: collection.questions.map(toExportQuestion),
  };

  return JSON.stringify(payload, null, 2);
}

export async function saveQuestionBankExport(
  collection: QuestionCollection,
  fileName = QUESTION_BANK_EXPORT_FILE_NAME,
) {
  return saveJsonFile(fileName, buildQuestionBankExportJson(collection));
}
