import { buildQuestionCollectionSummary } from "./questionCollectionValidation";
import { CollectionQuestion, QuestionCollection } from "./questionCollectionTypes";

export type ImportConflictResolution = "newIds" | "replaceExisting";

export type PendingImportConflict = {
  incomingCollection: QuestionCollection;
  duplicateIds: string[];
};

export type ImportCollectionResult =
  | { status: "imported" }
  | { status: "conflict"; duplicateIds: string[] }
  | { status: "invalid" }
  | { status: "cancelled" };

export function findDuplicateQuestionIds(
  existingQuestions: CollectionQuestion[],
  incomingQuestions: CollectionQuestion[],
) {
  const existingIds = new Set(existingQuestions.map((question) => question.id));
  const duplicateIds: string[] = [];

  for (const question of incomingQuestions) {
    if (existingIds.has(question.id)) {
      duplicateIds.push(question.id);
    }
  }

  return duplicateIds;
}

export function generateUniqueQuestionId(baseId: string, usedIds: Set<string>) {
  let nextId = `${baseId}-copy`;
  let index = 2;
  while (usedIds.has(nextId)) {
    nextId = `${baseId}-copy-${index}`;
    index += 1;
  }
  usedIds.add(nextId);
  return nextId;
}

export function importQuestionsWithNewIds(
  existingQuestions: CollectionQuestion[],
  incomingQuestions: CollectionQuestion[],
) {
  const existingIds = new Set(existingQuestions.map((question) => question.id));
  const usedIds = new Set([...existingIds, ...incomingQuestions.map((question) => question.id)]);

  const normalizedIncoming = incomingQuestions.map((question) => {
    if (!existingIds.has(question.id)) {
      return question;
    }

    return {
      ...question,
      id: generateUniqueQuestionId(question.id, usedIds),
    };
  });

  return [...existingQuestions, ...normalizedIncoming];
}

export function replaceExistingQuestions(
  existingQuestions: CollectionQuestion[],
  incomingQuestions: CollectionQuestion[],
) {
  const incomingById = new Map(incomingQuestions.map((question) => [question.id, question]));
  const mergedQuestions = existingQuestions.map(
    (question) => incomingById.get(question.id) || question,
  );

  for (const question of incomingQuestions) {
    if (!existingQuestions.some((existing) => existing.id === question.id)) {
      mergedQuestions.push(question);
    }
  }

  return mergedQuestions;
}

export function buildUpdatedQuestionCollection(
  currentCollection: QuestionCollection | null,
  questions: CollectionQuestion[],
) {
  return {
    version: currentCollection?.version || "1",
    importedAt: new Date().toISOString(),
    questions,
    summary: buildQuestionCollectionSummary(questions),
  } satisfies QuestionCollection;
}
