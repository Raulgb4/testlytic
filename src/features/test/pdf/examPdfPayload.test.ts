import { describe, expect, it } from "vitest";
import { RuntimeQuestion, TestDefinition } from "../testTypes";
import { buildExamPdfPayload } from "./examPdfPayload";
import {
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

  it("supports answer sheet chunking and option labels", () => {
    expect(
      chunkItems(
        Array.from({ length: 101 }, (_, index) => index + 1),
        50,
      ),
    ).toHaveLength(3);
    expect(getOptionLabel(0)).toBe("A");
    expect(getOptionLabel(25)).toBe("Z");
    expect(getOptionLabel(26)).toBe("AA");
  });

  it("builds safe PDF filenames", () => {
    expect(buildPdfFileName({ ...definition, title: "A/B: C?" }, "2026-06-10T12:00:00.000Z")).toBe(
      "testlytic-a-b-c-2026-06-10.pdf",
    );
  });
});
