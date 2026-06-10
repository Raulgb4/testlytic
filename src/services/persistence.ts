import { invoke } from "@tauri-apps/api/core";
import { Language } from "../i18n";
import { QuestionCollection } from "../features/test/questionCollectionTypes";
import {
  ActiveTestAttempt,
  CompletedTestAttempt,
  RuntimeQueueItem,
  TestDefinition,
} from "../features/test/testTypes";

type ThemeMode = "dark" | "light";

export type StoredPreferences = {
  language: Language;
  theme: ThemeMode;
};

export type ImportQuestionCollectionResponse =
  | { status: "imported"; collection: QuestionCollection }
  | { status: "conflict"; duplicateQuestions: { fingerprint: string; question: string }[] };

export type AttemptAnswerSnapshot = {
  queueId: string;
  sourceQuestionId: string;
  retryNumber: number;
  question: QuestionCollection["questions"][number];
  selectedOptionIds: string[];
  correctOptionIds: string[];
  isCorrect: boolean;
  isUnanswered: boolean;
  answeredAt?: string;
};

export type ActiveTestRecovery = {
  id: string;
  testDefinition: TestDefinition;
  activeAttempt: ActiveTestAttempt;
  savedAt: string;
  appVersion?: string;
};

export type QuestionExposureUpdate = {
  questionId: string;
  exposureCount: number;
};

export async function getPreferences() {
  return invoke<StoredPreferences>("get_preferences");
}

export async function setPreference(key: keyof StoredPreferences, value: string) {
  return invoke<void>("set_preference", { key, value });
}

export async function getQuestionCollection() {
  return invoke<QuestionCollection | null>("get_question_collection");
}

export async function importQuestionCollection(
  collection: QuestionCollection,
  merge: boolean,
  resolution?: "importCopies" | "replaceExisting",
) {
  return invoke<ImportQuestionCollectionResponse>("import_question_collection", {
    request: { collection, merge, resolution },
  });
}

export async function exportQuestionBank() {
  return invoke<{ version: "1"; questions: unknown[] }>("export_question_bank");
}

export async function listTestDefinitions() {
  return invoke<TestDefinition[]>("list_test_definitions");
}

export async function saveTestDefinition(definition: TestDefinition) {
  return invoke<void>("save_test_definition", { definition });
}

export async function deleteTestDefinition(id: string) {
  return invoke<void>("delete_test_definition", { id });
}

export async function generateTestQuestions(definition: TestDefinition) {
  return invoke<QuestionCollection["questions"]>("generate_test_questions", { definition });
}

export async function saveCompletedAttempt(
  attempt: CompletedTestAttempt,
  queue: RuntimeQueueItem[],
  submittedAnswers: Record<
    string,
    { selectedOptionIds: string[]; isCorrect: boolean; answeredAt: string } | undefined
  >,
) {
  const answers: AttemptAnswerSnapshot[] = queue.map((queueItem) => {
    const answer = submittedAnswers[queueItem.queueId];
    return {
      queueId: queueItem.queueId,
      sourceQuestionId: queueItem.sourceQuestionId,
      retryNumber: queueItem.retryNumber,
      question: {
        ...queueItem.question,
        shuffleOptions: queueItem.question.shuffleOptions ?? true,
        analytics: {
          computedDifficulty: "unrated",
          userDeclaredDifficulty: "unrated",
          timesAnsweredIncorrectly: 0,
          timesAnsweredCorrectly: 0,
          exposureCount: 0,
        },
      },
      selectedOptionIds: answer?.selectedOptionIds || [],
      correctOptionIds: queueItem.question.correctOptions,
      isCorrect: answer?.isCorrect || false,
      isUnanswered: !answer,
      answeredAt: answer?.answeredAt,
    };
  });

  return invoke<QuestionExposureUpdate[]>("save_completed_attempt", {
    request: { attempt, answers },
  });
}

export async function listCompletedAttempts() {
  return invoke<CompletedTestAttempt[]>("list_completed_attempts");
}

export async function deleteAllCompletedAttempts() {
  return invoke<void>("delete_all_completed_attempts");
}

export async function resetQuestionBank() {
  return invoke<void>("reset_question_bank");
}

export async function updateQuestionDifficulty(questionId: string, difficulty: string) {
  return invoke<void>("update_question_difficulty", { questionId, difficulty });
}

export async function getActiveTestAttempt() {
  const recovery = await invoke<ActiveTestRecovery | null>("get_active_test_attempt");
  if (!recovery) return null;
  return {
    ...recovery,
    activeAttempt: {
      ...recovery.activeAttempt,
      savedElapsedSeconds: recovery.activeAttempt.savedElapsedSeconds ?? 0,
    },
  };
}

export async function saveActiveTestAttempt(recovery: ActiveTestRecovery) {
  return invoke<void>("save_active_test_attempt", { recovery });
}

export async function clearActiveTestAttempt() {
  return invoke<void>("clear_active_test_attempt");
}
