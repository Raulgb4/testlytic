import { useState } from "react";
import { Translator } from "../../../app/types";
import { QuestionCollection } from "../questionCollectionTypes";
import { RuntimeQuestion, TestDefinition } from "../testTypes";
import { buildRuntimeQuestions } from "../testUtils";

export function usePdfExport({
  t,
  onGenerateQuestions,
  setToast,
}: {
  t: Translator;
  onGenerateQuestions: (definition: TestDefinition) => Promise<QuestionCollection["questions"]>;
  setToast: (toast: { message: string; variant: "success" | "error" }) => void;
}) {
  const [exportingPdfTestId, setExportingPdfTestId] = useState<string | null>(null);

  const exportPdfDefinition = async (definition: TestDefinition) => {
    if (exportingPdfTestId) return;
    setExportingPdfTestId(definition.id);
    try {
      let generatedQuestions: QuestionCollection["questions"];
      try {
        generatedQuestions = await onGenerateQuestions(definition);
      } catch (error) {
        console.error("Failed to generate PDF questions", error);
        setToast({ message: t("test.pdfExportQuestionsError"), variant: "error" });
        return;
      }

      let runtimeQuestions: RuntimeQuestion[];
      try {
        runtimeQuestions = buildRuntimeQuestions(definition, generatedQuestions);
      } catch (error) {
        console.error("Failed to build PDF runtime questions", error);
        setToast({ message: t("test.pdfExportQuestionsError"), variant: "error" });
        return;
      }

      if (runtimeQuestions.length === 0) {
        setToast({ message: t("test.noMatchingQuestions"), variant: "error" });
        return;
      }

      const { saveExamPdf } = await import("../pdf/examPdfExport");
      const result = await saveExamPdf({
        definition,
        runtimeQuestions,
        generatedAt: new Date().toISOString(),
      });

      if (result.status === "saved") {
        setToast({ message: t("test.pdfExportSavedSuccess"), variant: "success" });
      }
      if (result.status === "renderError") {
        setToast({ message: t("test.pdfExportRenderError"), variant: "error" });
      }
      if (result.status === "dialogError" || result.status === "writeError") {
        setToast({ message: t("test.pdfExportWriteError"), variant: "error" });
      }
    } catch (error) {
      console.error("Failed to export PDF", error);
      setToast({ message: t("test.pdfExportSavedError"), variant: "error" });
    } finally {
      setExportingPdfTestId(null);
    }
  };

  return { exportingPdfTestId, exportPdfDefinition };
}
