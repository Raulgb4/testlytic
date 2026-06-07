import {
  buildQuestionCollectionSummary,
  buildQuestionContentFingerprint,
  generateInternalQuestionId,
} from "./questionCollectionValidation";
import { CollectionQuestion, QuestionCollection } from "./questionCollectionTypes";

export type ImportConflictResolution = "importCopies" | "replaceExisting";

export type DuplicateQuestionPreview = {
  fingerprint: string;
  question: string;
};

export type PendingImportConflict = {
  incomingCollection: QuestionCollection;
  duplicateQuestions: DuplicateQuestionPreview[];
};

export type ImportCollectionResult =
  | { status: "imported" }
  | { status: "conflict"; duplicateQuestions: DuplicateQuestionPreview[] }
  | { status: "invalid" }
  | { status: "cancelled" };

function getQuestionFingerprint(question: CollectionQuestion) {
  return buildQuestionContentFingerprint(question);
}

export function findDuplicateQuestions(
  existingQuestions: CollectionQuestion[],
  incomingQuestions: CollectionQuestion[],
) {
  const existingFingerprints = new Set(existingQuestions.map(getQuestionFingerprint));
  const duplicateQuestions: DuplicateQuestionPreview[] = [];

  for (const question of incomingQuestions) {
    const fingerprint = getQuestionFingerprint(question);
    if (existingFingerprints.has(fingerprint)) {
      duplicateQuestions.push({ fingerprint, question: question.question });
    }
  }

  return duplicateQuestions;
}

export function importQuestionsAsCopies(
  existingQuestions: CollectionQuestion[],
  incomingQuestions: CollectionQuestion[],
) {
  const usedIds = new Set(existingQuestions.map((question) => question.id));

  const normalizedIncoming = incomingQuestions.map((question) => {
    const fingerprint = getQuestionFingerprint(question);

    return {
      ...question,
      id: generateInternalQuestionId(fingerprint, usedIds),
    };
  });

  return [...existingQuestions, ...normalizedIncoming];
}

export function replaceExistingQuestions(
  existingQuestions: CollectionQuestion[],
  incomingQuestions: CollectionQuestion[],
) {
  const incomingByFingerprint = new Map<string, CollectionQuestion[]>();
  for (const question of incomingQuestions) {
    const fingerprint = getQuestionFingerprint(question);
    incomingByFingerprint.set(fingerprint, [
      ...(incomingByFingerprint.get(fingerprint) || []),
      question,
    ]);
  }

  const mergedQuestions = existingQuestions.map((question) => {
    const fingerprint = getQuestionFingerprint(question);
    const incomingQuestionsForFingerprint = incomingByFingerprint.get(fingerprint) || [];
    const incomingQuestion = incomingQuestionsForFingerprint.shift();
    if (!incomingQuestion) return question;

    return {
      ...incomingQuestion,
      id: question.id,
      analytics: question.analytics,
    };
  });

  const usedIds = new Set(mergedQuestions.map((question) => question.id));

  for (const [fingerprint, questions] of incomingByFingerprint.entries()) {
    for (const question of questions) {
      const nextId = usedIds.has(question.id)
        ? generateInternalQuestionId(fingerprint, usedIds)
        : question.id;
      usedIds.add(nextId);
      mergedQuestions.push({ ...question, id: nextId });
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
