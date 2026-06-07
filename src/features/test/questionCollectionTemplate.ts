import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { ImportedQuestionCollection } from "./questionCollectionTypes";

export const QUESTION_COLLECTION_TEMPLATE_FILE_NAME = "testlytic-question-template.json";

export const QUESTION_COLLECTION_TEMPLATE: ImportedQuestionCollection = {
  version: "1",
  questions: [
    {
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

export function buildQuestionCollectionTemplateJson() {
  return JSON.stringify(QUESTION_COLLECTION_TEMPLATE, null, 2);
}

function downloadWithAnchor(fileName: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function saveJsonFile(fileName: string, json: string) {
  try {
    const selectedPath = await save({
      defaultPath: fileName,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!selectedPath) return { status: "cancelled" as const };
    await writeTextFile(selectedPath, json);
    return { status: "saved" as const };
  } catch {
    try {
      downloadWithAnchor(fileName, json);
      return { status: "saved" as const };
    } catch {
      return { status: "error" as const };
    }
  }
}

export async function saveQuestionCollectionTemplate(
  fileName = QUESTION_COLLECTION_TEMPLATE_FILE_NAME,
) {
  const json = buildQuestionCollectionTemplateJson();
  return saveJsonFile(fileName, json);
}
