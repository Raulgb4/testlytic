import { describe, expect, it } from "vitest";
import { buildQuestionCollectionTemplateJson } from "./questionCollectionTemplate";
import { validateQuestionCollectionJson } from "./questionCollectionValidation";

describe("question collection template", () => {
  it("builds valid importable template JSON", () => {
    const validation = validateQuestionCollectionJson(buildQuestionCollectionTemplateJson());

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.collection.questions).toHaveLength(1);
    expect(validation.collection.questions[0]).toMatchObject({
      questionCategory: "Analytics",
      questionSubcategory: "Core Metrics",
      shuffleOptions: true,
    });
  });
});
