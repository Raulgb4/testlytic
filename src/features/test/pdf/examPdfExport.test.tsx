import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeQuestion, TestDefinition } from "../testTypes";

const mocks = vi.hoisted(() => ({
  pdf: vi.fn(),
  saveBinaryFile: vi.fn(),
  invoke: vi.fn(),
}));

function PdfNode({ children }: { children?: unknown }) {
  return children;
}

vi.mock("@react-pdf/renderer", () => ({
  Document: PdfNode,
  Page: PdfNode,
  StyleSheet: { create: (styles: unknown) => styles },
  Text: PdfNode,
  View: PdfNode,
  pdf: mocks.pdf,
}));

vi.mock("../../../services/fileSave", () => ({
  saveBinaryFile: mocks.saveBinaryFile,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

const definition: TestDefinition = {
  id: "test-1",
  title: "Export only",
  questionLimit: 1,
  includedCategories: ["T1"],
  includedSubcategories: ["A1.2019"],
  allowUnanswered: false,
  negativeMarkingEnabled: false,
  penaltyPerIncorrectAnswer: 0,
  timeLimitMinutes: 0,
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z",
};

const runtimeQuestions: RuntimeQuestion[] = [
  {
    id: "q1",
    question: "Question 1",
    questionType: "single_choice",
    questionCategory: "T1",
    questionSubcategory: "A1.2019",
    options: [{ id: "a", text: "A" }],
    correctOptions: ["a"],
  },
];

async function saveDefaultExamPdf() {
  const { saveExamPdf } = await import("./examPdfExport");
  return saveExamPdf({
    definition,
    runtimeQuestions,
    generatedAt: "2026-06-11T12:00:00.000Z",
  });
}

describe("saveExamPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pdf.mockReturnValue({
      toBlob: async () => new Blob(["pdf-bytes"], { type: "application/pdf" }),
    });
    mocks.saveBinaryFile.mockResolvedValue({ status: "saved" as const });
  });

  it("saves rendered PDF bytes with a generated filename", async () => {
    await expect(saveDefaultExamPdf()).resolves.toEqual({ status: "saved" });

    expect(mocks.pdf).toHaveBeenCalledTimes(1);
    expect(mocks.saveBinaryFile).toHaveBeenCalledTimes(1);
    const [fileName, bytes] = mocks.saveBinaryFile.mock.calls[0];
    expect(fileName).toBe("testlytic-export-only-2026-06-11.pdf");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual(Array.from(new TextEncoder().encode("pdf-bytes")));
  });

  it("returns renderError when PDF rendering fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.pdf.mockReturnValue({
      toBlob: async () => {
        throw new Error("render failed");
      },
    });

    await expect(saveDefaultExamPdf()).resolves.toEqual({
      status: "renderError",
      error: "render failed",
    });
    expect(mocks.saveBinaryFile).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Failed to render exam PDF", expect.any(Error));

    consoleError.mockRestore();
  });

  it("returns cancelled save results", async () => {
    mocks.saveBinaryFile.mockResolvedValue({ status: "cancelled" as const });

    await expect(saveDefaultExamPdf()).resolves.toEqual({ status: "cancelled" });
  });

  it("returns dialog error save results", async () => {
    mocks.saveBinaryFile.mockResolvedValue({
      status: "dialogError" as const,
      error: "dialog unavailable",
    });

    await expect(saveDefaultExamPdf()).resolves.toEqual({
      status: "dialogError",
      error: "dialog unavailable",
    });
  });

  it("returns write error save results", async () => {
    mocks.saveBinaryFile.mockResolvedValue({
      status: "writeError" as const,
      error: "disk full",
    });

    await expect(saveDefaultExamPdf()).resolves.toEqual({
      status: "writeError",
      error: "disk full",
    });
  });

  it("does not call persistence APIs or mutate exposure state", async () => {
    await expect(saveDefaultExamPdf()).resolves.toEqual({ status: "saved" });

    expect(mocks.saveBinaryFile).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).not.toHaveBeenCalledWith("save_completed_attempt", expect.anything());
    expect(mocks.invoke).not.toHaveBeenCalledWith("generate_test_questions", expect.anything());
    expect(mocks.invoke).not.toHaveBeenCalledWith("mark_questions_exposed", expect.anything());
    expect(mocks.invoke).not.toHaveBeenCalledWith("save_active_test_attempt", expect.anything());
    expect(mocks.invoke).not.toHaveBeenCalledWith("clear_active_test_attempt", expect.anything());
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
