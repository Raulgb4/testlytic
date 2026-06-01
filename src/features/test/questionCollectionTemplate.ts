import { ImportedQuestionCollection } from "./questionCollectionTypes";

export const QUESTION_COLLECTION_TEMPLATE: ImportedQuestionCollection = {
  version: "1",
  questions: [
    {
      id: "q-001",
      question: "Which metric best tracks study consistency over time?",
      auxiliaryInformation: "Pick the most representative analytics metric.",
      questionType: "single_choice",
      options: [
        { id: "a", text: "Maximum single score" },
        { id: "b", text: "Average score across completed tests" },
        { id: "c", text: "Most recent topic attempted" },
      ],
      correctOptions: ["b"],
      correctAnswerExplanation: "Average score across completed tests is stable over time.",
      questionCategory: "Analytics",
      questionSubcategory: "Core Metrics",
      questionSource: "Template",
    },
  ],
};

export function downloadQuestionCollectionTemplate(fileName = "testlytic-question-template.json") {
  const json = JSON.stringify(QUESTION_COLLECTION_TEMPLATE, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
