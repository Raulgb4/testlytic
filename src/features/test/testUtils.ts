import { CollectionQuestion } from "./questionCollectionTypes";
import { ActiveTestAttempt, RuntimeQuestion, TestAttempt, TestDefinition } from "./testTypes";

function shuffleArray<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function getCategoryOptions(questions: CollectionQuestion[]) {
  return Array.from(new Set(questions.map((q) => q.questionCategory))).sort();
}

export function getSubcategoryOptions(questions: CollectionQuestion[], categories: string[]) {
  const set = new Set<string>();
  for (const question of questions) {
    if (!categories.includes(question.questionCategory)) continue;
    if (question.questionSubcategory) set.add(question.questionSubcategory);
  }
  return Array.from(set).sort();
}

export function getMatchingQuestions(definition: TestDefinition, bankQuestions: CollectionQuestion[]) {
  const hasSubcategories = (definition.includedSubcategories || []).length > 0;
  return bankQuestions.filter((question) => {
    if (!definition.includedCategories.includes(question.questionCategory)) {
      return false;
    }
    if (!hasSubcategories) {
      return true;
    }
    return Boolean(
      question.questionSubcategory &&
        definition.includedSubcategories?.includes(question.questionSubcategory),
    );
  });
}

export function buildRuntimeQuestions(definition: TestDefinition, bankQuestions: CollectionQuestion[]) {
  const matching = getMatchingQuestions(definition, bankQuestions);
  const limited = shuffleArray(matching).slice(0, Math.min(definition.questionLimit, matching.length));
  return limited.map<RuntimeQuestion>((question) => ({
    id: question.id,
    question: question.question,
    auxiliaryInformation: question.auxiliaryInformation,
    questionType: question.questionType,
    questionCategory: question.questionCategory,
    questionSubcategory: question.questionSubcategory,
    options: shuffleArray(question.options),
    correctOptions: question.correctOptions,
    correctAnswerExplanation: question.correctAnswerExplanation,
  }));
}

export function isExactSetMatch(selectedOptionIds: string[], correctOptions: string[]) {
  if (selectedOptionIds.length !== correctOptions.length) return false;
  const selectedSet = new Set(selectedOptionIds);
  return correctOptions.every((optionId) => selectedSet.has(optionId));
}

export function calculateAttemptResult(
  activeAttempt: ActiveTestAttempt,
  definition: TestDefinition,
): TestAttempt {
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let unansweredQuestions = 0;
  let retryCorrectAnswers = 0;
  let retryIncorrectAnswers = 0;
  const categoryMap = new Map<string, { correct: number; incorrect: number; unanswered: number; total: number }>();

  for (const queueItem of activeAttempt.queue) {
    const answer = activeAttempt.submittedAnswers[queueItem.queueId];
    const isRetry = queueItem.retryNumber > 0;
    if (isRetry) {
      if (answer?.isCorrect) retryCorrectAnswers += 1;
      if (answer && !answer.isCorrect) retryIncorrectAnswers += 1;
      continue;
    }

    const category = queueItem.question.questionSubcategory
      ? `${queueItem.question.questionCategory} / ${queueItem.question.questionSubcategory}`
      : queueItem.question.questionCategory;
    const current = categoryMap.get(category) ?? { correct: 0, incorrect: 0, unanswered: 0, total: 0 };
    current.total += 1;

    if (!answer || answer.selectedOptionIds.length === 0) {
      unansweredQuestions += 1;
      current.unanswered += 1;
      categoryMap.set(category, current);
      continue;
    }
    if (answer.isCorrect) {
      correctAnswers += 1;
      current.correct += 1;
    } else {
      incorrectAnswers += 1;
      current.incorrect += 1;
    }
    categoryMap.set(category, current);
  }

  const completedAtIso = new Date().toISOString();
  const startedAtMs = new Date(activeAttempt.startedAt).getTime();
  const completedAtMs = new Date(completedAtIso).getTime();
  const rawScore = correctAnswers;
  const finalScore = definition.negativeMarkingEnabled
    ? correctAnswers - incorrectAnswers * definition.penaltyPerIncorrectAnswer
    : correctAnswers;
  const totalQuestions = activeAttempt.originalQuestionCount;
  const accuracyPercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  const gradeOutOf10 = Math.max(0, Math.min(10, totalQuestions > 0 ? (finalScore / totalQuestions) * 10 : 0));

  return {
    id: `attempt-${Date.now()}`,
    testId: activeAttempt.testId,
    testTitle: definition.title,
    startedAt: activeAttempt.startedAt,
    completedAt: completedAtIso,
    durationSeconds: Math.max(0, Math.floor((completedAtMs - startedAtMs) / 1000)),
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    unansweredQuestions,
    rawScore,
    finalScore,
    accuracyPercentage,
    gradeOutOf10,
    retryAttempts: retryCorrectAnswers + retryIncorrectAnswers,
    retryCorrectAnswers,
    retryIncorrectAnswers,
    categoryResults: Array.from(categoryMap.entries()).map(([category, result]) => ({
      category,
      ...result,
      accuracyPercentage: result.total > 0 ? (result.correct / result.total) * 100 : 0,
    })),
  };
}
