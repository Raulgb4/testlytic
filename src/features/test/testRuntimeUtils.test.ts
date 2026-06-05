import { describe, expect, it } from "vitest";
import { ActiveTestAttempt, TestDefinition } from "./testTypes";
import {
  getEffectiveTimeLimitMinutes,
  getFinishSummary,
  isTimeLimitEnabled,
} from "./testRuntimeUtils";

describe("testRuntimeUtils", () => {
  it("uses legacy positive timeLimitMinutes as enabled", () => {
    const definition = { timeLimitMinutes: 15 } as TestDefinition;
    expect(isTimeLimitEnabled(definition)).toBe(true);
    expect(getEffectiveTimeLimitMinutes(definition)).toBe(15);
  });

  it("disables time limit when the flag is false", () => {
    const definition = { timeLimitEnabled: false, timeLimitMinutes: 30 } as TestDefinition;
    expect(isTimeLimitEnabled(definition)).toBe(false);
    expect(getEffectiveTimeLimitMinutes(definition)).toBe(0);
  });

  it("counts only original questions in finish summary", () => {
    const activeAttempt: ActiveTestAttempt = {
      id: "attempt-1",
      testId: "test-1",
      startedAt: "2026-06-05T10:00:00.000Z",
      originalQuestionCount: 3,
      currentQueueIndex: 0,
      draftSelections: {},
      queue: [
        {
          queueId: "q1-0",
          sourceQuestionId: "q1",
          retryNumber: 0,
          question: {
            id: "q1",
            question: "Q1",
            questionType: "single_choice",
            questionCategory: "A",
            options: [{ id: "a", text: "A" }],
            correctOptions: ["a"],
          },
        },
        {
          queueId: "q2-0",
          sourceQuestionId: "q2",
          retryNumber: 0,
          question: {
            id: "q2",
            question: "Q2",
            questionType: "single_choice",
            questionCategory: "A",
            options: [{ id: "a", text: "A" }],
            correctOptions: ["a"],
          },
        },
        {
          queueId: "q3-0",
          sourceQuestionId: "q3",
          retryNumber: 0,
          question: {
            id: "q3",
            question: "Q3",
            questionType: "single_choice",
            questionCategory: "A",
            options: [{ id: "a", text: "A" }],
            correctOptions: ["a"],
          },
        },
        {
          queueId: "q2-1",
          sourceQuestionId: "q2",
          retryNumber: 1,
          question: {
            id: "q2",
            question: "Q2 retry",
            questionType: "single_choice",
            questionCategory: "A",
            options: [{ id: "a", text: "A" }],
            correctOptions: ["a"],
          },
        },
      ],
      submittedAnswers: {
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
    };

    expect(getFinishSummary(activeAttempt)).toEqual({
      answered: 2,
      unanswered: 1,
      correct: 1,
      incorrect: 1,
    });
  });
});
