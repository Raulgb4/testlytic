import { describe, expect, it } from "vitest";
import { ActiveTestAttempt, TestDefinition } from "./testTypes";
import {
  getEffectiveTimeLimitMinutes,
  getFinishSummary,
  isTimeLimitEnabled,
} from "./testRuntimeUtils";

function activeAttempt(
  queue: ActiveTestAttempt["queue"],
  submittedAnswers: ActiveTestAttempt["submittedAnswers"] = {},
): ActiveTestAttempt {
  return {
    id: "attempt-1",
    testId: "test-1",
    startedAt: "2026-06-05T10:00:00.000Z",
    savedElapsedSeconds: 0,
    originalQuestionCount: queue.filter((item) => item.retryNumber === 0).length,
    currentQueueIndex: 0,
    draftSelections: {},
    queue,
    submittedAnswers,
  };
}

function queueItem(queueId: string, retryNumber = 0): ActiveTestAttempt["queue"][number] {
  return {
    queueId,
    sourceQuestionId: queueId.split("-")[0],
    retryNumber,
    question: {
      id: queueId,
      question: `Question ${queueId}`,
      questionType: "single_choice",
      questionCategory: "A",
      options: [{ id: "a", text: "A" }],
      correctOptions: ["a"],
    },
  };
}

describe("testRuntimeUtils", () => {
  it("uses explicit enabled positive time limit", () => {
    const definition = { timeLimitEnabled: true, timeLimitMinutes: 25 } as TestDefinition;
    expect(isTimeLimitEnabled(definition)).toBe(true);
    expect(getEffectiveTimeLimitMinutes(definition)).toBe(25);
  });

  it("treats explicit enabled zero or negative limits as enabled with zero effective minutes", () => {
    const zero = { timeLimitEnabled: true, timeLimitMinutes: 0 } as TestDefinition;
    const negative = { timeLimitEnabled: true, timeLimitMinutes: -5 } as TestDefinition;

    expect(isTimeLimitEnabled(zero)).toBe(true);
    expect(getEffectiveTimeLimitMinutes(zero)).toBe(0);
    expect(isTimeLimitEnabled(negative)).toBe(true);
    expect(getEffectiveTimeLimitMinutes(negative)).toBe(0);
  });

  it("uses legacy positive timeLimitMinutes as enabled", () => {
    const definition = { timeLimitMinutes: 15 } as TestDefinition;
    expect(isTimeLimitEnabled(definition)).toBe(true);
    expect(getEffectiveTimeLimitMinutes(definition)).toBe(15);
  });

  it("uses legacy zero or negative timeLimitMinutes as disabled when flag is undefined", () => {
    const zero = { timeLimitMinutes: 0 } as TestDefinition;
    const negative = { timeLimitMinutes: -5 } as TestDefinition;

    expect(isTimeLimitEnabled(zero)).toBe(false);
    expect(getEffectiveTimeLimitMinutes(zero)).toBe(0);
    expect(isTimeLimitEnabled(negative)).toBe(false);
    expect(getEffectiveTimeLimitMinutes(negative)).toBe(0);
  });

  it("disables time limit when the flag is false", () => {
    const definition = { timeLimitEnabled: false, timeLimitMinutes: 30 } as TestDefinition;
    expect(isTimeLimitEnabled(definition)).toBe(false);
    expect(getEffectiveTimeLimitMinutes(definition)).toBe(0);
  });

  it("counts only original questions in finish summary", () => {
    const attempt = activeAttempt(
      [queueItem("q1-0"), queueItem("q2-0"), queueItem("q3-0"), queueItem("q2-1", 1)],
      {
        "q1-0": {
          selectedOptionIds: ["a"],
          isCorrect: true,
          answeredAt: "2026-06-05T10:01:00.000Z",
          attemptNumber: 1,
        },
        "q2-0": {
          selectedOptionIds: ["b"],
          isCorrect: false,
          answeredAt: "2026-06-05T10:02:00.000Z",
          attemptNumber: 1,
        },
        "q2-1": {
          selectedOptionIds: ["a"],
          isCorrect: true,
          answeredAt: "2026-06-05T10:03:00.000Z",
          attemptNumber: 2,
        },
      },
    );

    expect(getFinishSummary(attempt)).toEqual({
      answered: 2,
      unanswered: 1,
      correct: 1,
      incorrect: 1,
    });
  });

  it("handles all unanswered original questions while ignoring answered retries", () => {
    const attempt = activeAttempt([queueItem("q1-0"), queueItem("q2-0"), queueItem("q1-1", 1)], {
      "q1-1": {
        selectedOptionIds: ["a"],
        isCorrect: true,
        answeredAt: "2026-06-05T10:03:00.000Z",
        attemptNumber: 2,
      },
    });

    expect(getFinishSummary(attempt)).toEqual({
      answered: 0,
      unanswered: 2,
      correct: 0,
      incorrect: 0,
    });
  });
});
