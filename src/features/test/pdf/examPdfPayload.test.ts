import { describe, expect, it } from "vitest";
import { RuntimeQuestion, TestDefinition } from "../testTypes";
import { buildExamPdfPayload } from "./examPdfPayload";
import {
  ANSWER_ROWS_PER_PAGE,
  buildPdfFileName,
  chunkItems,
  getCorrectOptionLabels,
  getOptionLabel,
} from "./pdfLayoutUtils";

const definition: TestDefinition = {
  id: "test-1",
  title: "A1/A2 ICT Practice",
  questionLimit: 2,
  includedCategories: ["Law", "Systems"],
  includedSubcategories: ["Security"],
  allowUnanswered: true,
  timeLimitEnabled: true,
  negativeMarkingEnabled: true,
  penaltyPerIncorrectAnswer: 0.33,
  timeLimitMinutes: 120,
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z",
};

const runtimeQuestions: RuntimeQuestion[] = [
  {
    id: "q1",
    question: "First question",
    questionType: "single_choice",
    questionCategory: "Law",
    options: [
      { id: "b", text: "Visible A" },
      { id: "c", text: "Visible B" },
      { id: "a", text: "Visible C" },
    ],
    correctOptions: ["a"],
    shuffleOptions: false,
  },
  {
    id: "q2",
    question: "Second question",
    questionType: "multiple_choice",
    questionCategory: "Systems",
    questionSubcategory: "Security",
    options: [
      { id: "a", text: "Visible A" },
      { id: "b", text: "Visible B" },
      { id: "c", text: "Visible C" },
      { id: "d", text: "Visible D" },
    ],
    correctOptions: ["a", "d"],
    shuffleOptions: true,
  },
];

describe("exam PDF payload", () => {
  it("freezes generated question and option order", () => {
    const payload = buildExamPdfPayload({
      definition,
      runtimeQuestions,
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(payload.questions.map((question) => question.id)).toEqual(["q1", "q2"]);
    expect(payload.questions[0].options.map((option) => option.id)).toEqual(["b", "c", "a"]);
    expect(payload.questions[0].number).toBe(1);
    expect(payload.questions[1].number).toBe(2);
  });

  it("preserves shuffleOptions false option order in the payload", () => {
    const payload = buildExamPdfPayload({
      definition,
      runtimeQuestions,
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(payload.questions[0].shuffleOptions).toBe(false);
    expect(payload.questions[0].options.map((option) => option.id)).toEqual(["b", "c", "a"]);
  });

  it("builds answer key from visible option labels", () => {
    const payload = buildExamPdfPayload({
      definition,
      runtimeQuestions,
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(getCorrectOptionLabels(runtimeQuestions[0])).toEqual(["C"]);
    expect(payload.answerKey).toEqual([
      { questionNumber: 1, correctLabels: ["C"] },
      { questionNumber: 2, correctLabels: ["A", "D"] },
    ]);
  });

  it("builds Spanish PDF metadata without translating imported content", () => {
    const payload = buildExamPdfPayload({
      definition,
      runtimeQuestions,
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(payload.metadata).toMatchObject({
      questionCount: 2,
      categorySummary: "Law, Systems",
      subcategorySummary: "Security",
      timeLimit: "120 minutos",
      negativeMarking: "Penalización de 0.33 por respuesta incorrecta",
      allowUnanswered: "Sí",
    });
    expect(payload.questions[0].question).toBe("First question");
    expect(payload.questions[0].options.map((option) => option.text)).toEqual([
      "Visible A",
      "Visible B",
      "Visible C",
    ]);
  });

  it("uses Spanish fallback metadata values", () => {
    const payload = buildExamPdfPayload({
      definition: {
        ...definition,
        includedCategories: [],
        includedSubcategories: [],
        allowUnanswered: false,
        timeLimitEnabled: false,
        negativeMarkingEnabled: false,
      },
      runtimeQuestions: [],
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(payload.metadata.categorySummary).toBe("Todas");
    expect(payload.metadata.subcategorySummary).toBe("Ninguna");
    expect(payload.metadata.timeLimit).toBe("Sin límite de tiempo");
    expect(payload.metadata.negativeMarking).toBe("Desactivada");
    expect(payload.metadata.allowUnanswered).toBe("No");
  });

  it("summarizes more than four categories and subcategories", () => {
    const payload = buildExamPdfPayload({
      definition,
      runtimeQuestions: [
        { ...runtimeQuestions[0], id: "q1", questionCategory: "T5", questionSubcategory: "A5" },
        { ...runtimeQuestions[0], id: "q2", questionCategory: "T1", questionSubcategory: "A1" },
        { ...runtimeQuestions[0], id: "q3", questionCategory: "T3", questionSubcategory: "A3" },
        { ...runtimeQuestions[0], id: "q4", questionCategory: "T2", questionSubcategory: "A2" },
        { ...runtimeQuestions[0], id: "q5", questionCategory: "T4", questionSubcategory: "A4" },
      ],
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(payload.metadata.categorySummary).toBe("T1, T2, T3, T4 +1 más");
    expect(payload.metadata.subcategorySummary).toBe("A1, A2, A3, A4 +1 más");
  });

  it("uses legacy positive time limits when the enabled flag is absent", () => {
    const payload = buildExamPdfPayload({
      definition: { ...definition, timeLimitEnabled: undefined, timeLimitMinutes: 45 },
      runtimeQuestions,
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(payload.metadata.timeLimit).toBe("45 minutos");
  });

  it("supports answer sheet chunking and option labels", () => {
    expect(
      chunkItems(
        Array.from({ length: ANSWER_ROWS_PER_PAGE * 2 + 1 }, (_, index) => index + 1),
        ANSWER_ROWS_PER_PAGE,
      ),
    ).toHaveLength(3);
    expect(getOptionLabel(0)).toBe("A");
    expect(getOptionLabel(25)).toBe("Z");
    expect(getOptionLabel(26)).toBe("AA");
    expect(getOptionLabel(51)).toBe("AZ");
    expect(getOptionLabel(52)).toBe("BA");
  });

  it("does not mutate runtime questions or analytics-like source data", () => {
    const sourceQuestions = runtimeQuestions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    }));

    buildExamPdfPayload({
      definition,
      runtimeQuestions: sourceQuestions,
      generatedAt: "2026-06-10T12:00:00.000Z",
    });

    expect(sourceQuestions).toEqual(runtimeQuestions);
  });

  it("builds safe PDF filenames", () => {
    expect(buildPdfFileName({ ...definition, title: "A/B: C?" }, "2026-06-10T12:00:00.000Z")).toBe(
      "testlytic-a-b-c-2026-06-10.pdf",
    );
  });

  it("falls back to test when the title is blank or only invalid filename characters", () => {
    expect(buildPdfFileName({ ...definition, title: "   " }, "2026-06-10T12:00:00.000Z")).toBe(
      "testlytic-test-2026-06-10.pdf",
    );
    expect(
      buildPdfFileName({ ...definition, title: '<>:"/\\|?*' }, "2026-06-10T12:00:00.000Z"),
    ).toBe("testlytic-test-2026-06-10.pdf");
  });
});
