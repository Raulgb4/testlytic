import { pdf } from "@react-pdf/renderer";
import { FileSaveResult, saveBinaryFile } from "../../../services/fileSave";
import { RuntimeQuestion, TestDefinition } from "../testTypes";
import { ExamPdfDocument } from "./ExamPdfDocument";
import { buildExamPdfPayload } from "./examPdfPayload";
import { buildPdfFileName } from "./pdfLayoutUtils";

export type ExamPdfSaveResult = FileSaveResult | { status: "renderError"; error: string };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function saveExamPdf({
  definition,
  runtimeQuestions,
  generatedAt,
}: {
  definition: TestDefinition;
  runtimeQuestions: RuntimeQuestion[];
  generatedAt: string;
}): Promise<ExamPdfSaveResult> {
  const payload = buildExamPdfPayload({ definition, runtimeQuestions, generatedAt });
  let bytes: Uint8Array;
  try {
    const blob = await pdf(<ExamPdfDocument payload={payload} />).toBlob();
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Failed to render exam PDF", error);
    return { status: "renderError", error: message };
  }

  return saveBinaryFile(buildPdfFileName(definition, generatedAt), bytes);
}
