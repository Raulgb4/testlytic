import React, { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { TestDefinition } from "../testTypes";
import { ExamPdfDocument } from "./ExamPdfDocument";
import { ExamPdfPayload, ExamPdfQuestion } from "./examPdfTypes";

function PdfNode({ children, ...props }: { children?: React.ReactNode }) {
  return React.createElement("pdf-node", props, children);
}

vi.mock("@react-pdf/renderer", () => ({
  Document: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement("pdf-document", props, children),
  Page: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement("pdf-page", props, children),
  StyleSheet: { create: (styles: unknown) => styles },
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement("pdf-text", props, children),
  View: PdfNode,
}));

type RenderedNode = string | number | null | undefined | boolean | RenderedElement | RenderedNode[];

type RenderedElement = {
  type: string | symbol;
  props: Record<string, unknown> & { children?: RenderedNode };
};

const definition: TestDefinition = {
  id: "test-1",
  title: "Printable Exam",
  questionLimit: 2,
  includedCategories: ["T1"],
  includedSubcategories: ["A1"],
  allowUnanswered: true,
  timeLimitEnabled: true,
  negativeMarkingEnabled: false,
  penaltyPerIncorrectAnswer: 0,
  timeLimitMinutes: 30,
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z",
};

function question(number: number, overrides: Partial<ExamPdfQuestion> = {}): ExamPdfQuestion {
  return {
    id: `q${number}`,
    number,
    question: `Question ${number}`,
    questionType: "single_choice",
    questionCategory: "T1",
    options: [
      { id: "a", text: `Option A ${number}` },
      { id: "b", text: `Option B ${number}` },
      { id: "c", text: `Option C ${number}` },
    ],
    correctOptions: ["a"],
    ...overrides,
  };
}

function payload(overrides: Partial<ExamPdfPayload> = {}): ExamPdfPayload {
  const questions = overrides.questions ?? [question(1), question(2)];
  return {
    definition,
    generatedAt: "2026-06-11T12:00:00.000Z",
    questions,
    metadata: {
      generatedAt: "2026-06-11T12:00:00.000Z",
      questionCount: questions.length,
      categorySummary: "T1",
      subcategorySummary: "A1",
      timeLimit: "30 minutos",
      negativeMarking: "Desactivada",
      allowUnanswered: "Sí",
    },
    answerKey: questions.map((item) => ({ questionNumber: item.number, correctLabels: ["A"] })),
    maxOptionCount: Math.max(4, ...questions.map((item) => item.options.length)),
    ...overrides,
  };
}

function renderNode(node: React.ReactNode): RenderedNode {
  if (node === null || node === undefined || typeof node === "boolean") return node;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(renderNode);
  if (!isValidElement(node)) return null;

  if (typeof node.type === "function") {
    const Component = node.type as (props: unknown) => React.ReactNode;
    return renderNode(Component(node.props));
  }

  const props = node.props as Record<string, unknown> & { children?: React.ReactNode };
  return {
    type: node.type,
    props: {
      ...props,
      children: renderNode(props.children),
    },
  };
}

function flattenNodes(node: RenderedNode): RenderedElement[] {
  if (!node || typeof node === "boolean" || typeof node === "string" || typeof node === "number") {
    return [];
  }
  if (Array.isArray(node)) return node.flatMap(flattenNodes);
  return [node, ...flattenNodes(node.props.children)];
}

function textContent(node: RenderedNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return textContent(node.props.children);
}

function renderDocument(documentPayload: ExamPdfPayload) {
  return renderNode(<ExamPdfDocument payload={documentPayload} />);
}

function renderedText(documentPayload: ExamPdfPayload) {
  return textContent(renderDocument(documentPayload));
}

function countPagesContaining(documentPayload: ExamPdfPayload, value: string) {
  return flattenNodes(renderDocument(documentPayload)).filter(
    (node) => node.type === "pdf-page" && textContent(node).includes(value),
  ).length;
}

describe("ExamPdfDocument", () => {
  it("includes cover, questions, answer sheet, and solutions sections", () => {
    const text = renderedText(payload());

    expect(text).toContain("Printable Exam");
    expect(text).toContain("Información del test");
    expect(text).toContain("Preguntas");
    expect(text).toContain("HOJA DE RESPUESTAS");
    expect(text).toContain("Plantilla de respuestas");
  });

  it("renders auxiliary information when present", () => {
    const text = renderedText(
      payload({ questions: [question(1, { auxiliaryInformation: "Read this source first." })] }),
    );

    expect(text).toContain("Read this source first.");
  });

  it("omits auxiliary information when absent", () => {
    const text = renderedText(payload({ questions: [question(1)] }));

    expect(text).not.toContain("Read this source first.");
  });

  it("renders unavailable answer cells for questions with fewer options than maxOptionCount", () => {
    const rendered = renderDocument(
      payload({
        questions: [question(1, { options: [{ id: "a", text: "Only option" }] })],
        maxOptionCount: 4,
      }),
    );
    const unavailableCells = flattenNodes(rendered).filter((node) => {
      const style = node.props.style as { backgroundColor?: string } | undefined;
      return style?.backgroundColor === "#eeeeee" && textContent(node) === "-";
    });

    expect(unavailableCells).toHaveLength(3);
  });

  it("renders a dash in solutions when no correct visible label exists", () => {
    const text = renderedText(
      payload({
        questions: [question(1)],
        answerKey: [{ questionNumber: 1, correctLabels: [] }],
      }),
    );

    expect(text).toContain("1. -");
  });

  it("paginates answer sheets", () => {
    const questions = Array.from({ length: 33 }, (_, index) => question(index + 1));

    expect(countPagesContaining(payload({ questions }), "Hoja de respuestas")).toBe(2);
  });

  it("paginates solutions", () => {
    const questions = Array.from({ length: 73 }, (_, index) => question(index + 1));

    expect(countPagesContaining(payload({ questions }), "Soluciones")).toBe(2);
  });
});
