import { RuntimeQuestion, TestDefinition } from "../testTypes";

export function getOptionLabel(index: number) {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

export function getCorrectOptionLabels(question: RuntimeQuestion) {
  return question.options
    .map((option, index) =>
      question.correctOptions.includes(option.id) ? getOptionLabel(index) : null,
    )
    .filter((label): label is string => Boolean(label));
}

export function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function buildPdfFileName(definition: TestDefinition, generatedAt: string) {
  const date = generatedAt.slice(0, 10);
  const title = sanitizeFileName(definition.title) || "test";
  return `testlytic-${title}-${date}.pdf`;
}
