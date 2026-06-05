import { ActiveTestAttempt, TestDefinition } from "./testTypes";

export type FinishSummary = {
  answered: number;
  unanswered: number;
  correct: number;
  incorrect: number;
};

export function isTimeLimitEnabled(
  definition: Pick<TestDefinition, "timeLimitEnabled" | "timeLimitMinutes">,
) {
  return definition.timeLimitEnabled ?? definition.timeLimitMinutes > 0;
}

export function getEffectiveTimeLimitMinutes(
  definition: Pick<TestDefinition, "timeLimitEnabled" | "timeLimitMinutes">,
) {
  return isTimeLimitEnabled(definition) ? Math.max(0, definition.timeLimitMinutes) : 0;
}

export function getFinishSummary(activeAttempt: ActiveTestAttempt): FinishSummary {
  let answered = 0;
  let unanswered = 0;
  let correct = 0;
  let incorrect = 0;

  for (const queueItem of activeAttempt.queue) {
    if (queueItem.retryNumber > 0) continue;
    const answer = activeAttempt.submittedAnswers[queueItem.queueId];
    if (!answer) {
      unanswered += 1;
      continue;
    }
    answered += 1;
    if (answer.isCorrect) {
      correct += 1;
    } else {
      incorrect += 1;
    }
  }

  return { answered, unanswered, correct, incorrect };
}
