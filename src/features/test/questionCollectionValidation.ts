import {
  CollectionQuestion,
  QuestionCollection,
  QuestionCollectionSummary,
  QuestionAnalytics,
  ValidationIssue,
  ValidationResult,
} from "./questionCollectionTypes";

const DEFAULT_ANALYTICS: QuestionAnalytics = {
  computedDifficulty: "unrated",
  userDeclaredDifficulty: "unrated",
  timesAnsweredIncorrectly: 0,
  timesAnsweredCorrectly: 0,
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildQuestionCollectionSummary(
  questions: CollectionQuestion[],
): QuestionCollectionSummary {
  const categories = new Set<string>();
  const subcategories = new Set<string>();
  const sources = new Set<string>();
  let totalSingleChoice = 0;
  let totalMultipleChoice = 0;

  for (const question of questions) {
    categories.add(question.questionCategory);
    if (question.questionSubcategory) subcategories.add(question.questionSubcategory);
    if (question.questionSource) sources.add(question.questionSource);
    if (question.questionType === "single_choice") totalSingleChoice += 1;
    if (question.questionType === "multiple_choice") totalMultipleChoice += 1;
  }

  return {
    totalQuestions: questions.length,
    totalCategories: categories.size,
    totalSubcategories: subcategories.size,
    totalSingleChoice,
    totalMultipleChoice,
    totalSources: sources.size,
  };
}

export function validateQuestionCollectionJson(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      errors: [{ path: "root", message: "Invalid JSON format." }],
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: [{ path: "root", message: "Root must be an object." }],
    };
  }

  const input = parsed as Record<string, unknown>;
  const errors: ValidationIssue[] = [];

  if (input.version !== "1") {
    errors.push({ path: "version", message: 'Version must be exactly "1".' });
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    errors.push({ path: "questions", message: "Questions must be a non-empty array." });
  }

  if (errors.length > 0) return { ok: false, errors };

  const sourceQuestions = input.questions as unknown[];
  const seenQuestionIds = new Set<string>();
  const normalizedQuestions: CollectionQuestion[] = [];

  sourceQuestions.forEach((entry, index) => {
    const path = `questions[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push({ path, message: "Question must be an object." });
      return;
    }

    const question = entry as Record<string, unknown>;
    const id = asString(question.id);
    if (!id) {
      errors.push({ path: `${path}.id`, message: "Question ID is required." });
    } else if (seenQuestionIds.has(id)) {
      errors.push({ path: `${path}.id`, message: "Question ID must be unique." });
    } else {
      seenQuestionIds.add(id);
    }

    const prompt = asString(question.question);
    if (!prompt) {
      errors.push({ path: `${path}.question`, message: "Question text is required." });
    }

    const type = question.questionType;
    if (type !== "single_choice" && type !== "multiple_choice") {
      errors.push({
        path: `${path}.questionType`,
        message: 'Question Type must be "single_choice" or "multiple_choice".',
      });
    }

    const category = asString(question.questionCategory);
    if (!category) {
      errors.push({ path: `${path}.questionCategory`, message: "Question Category is required." });
    }

    const optionalAux = optionalString(question.auxiliaryInformation);
    const optionalExplanation = optionalString(question.correctAnswerExplanation);
    const optionalSubcategory = optionalString(question.questionSubcategory);
    const optionalSource = optionalString(question.questionSource);

    if (optionalAux === null) {
      errors.push({
        path: `${path}.auxiliaryInformation`,
        message: "Auxiliary Information must be a string when provided.",
      });
    }
    if (optionalExplanation === null) {
      errors.push({
        path: `${path}.correctAnswerExplanation`,
        message: "Correct Answer Explanation must be a string when provided.",
      });
    }
    if (optionalSubcategory === null) {
      errors.push({
        path: `${path}.questionSubcategory`,
        message: "Question Subcategory must be a string when provided.",
      });
    }
    if (optionalSource === null) {
      errors.push({
        path: `${path}.questionSource`,
        message: "Question Source must be a string when provided.",
      });
    }

    const optionsValue = question.options;
    if (!Array.isArray(optionsValue) || optionsValue.length < 2) {
      errors.push({ path: `${path}.options`, message: "Options must include at least 2 entries." });
    }

    const normalizedOptions: { id: string; text: string }[] = [];
    const seenOptionIds = new Set<string>();
    if (Array.isArray(optionsValue)) {
      optionsValue.forEach((optionEntry, optionIndex) => {
        const optionPath = `${path}.options[${optionIndex}]`;
        if (!optionEntry || typeof optionEntry !== "object" || Array.isArray(optionEntry)) {
          errors.push({ path: optionPath, message: "Option must be an object." });
          return;
        }
        const option = optionEntry as Record<string, unknown>;
        const optionId = asString(option.id);
        const optionText = asString(option.text);
        if (!optionId) {
          errors.push({ path: `${optionPath}.id`, message: "Option ID is required." });
        } else if (seenOptionIds.has(optionId)) {
          errors.push({ path: `${optionPath}.id`, message: "Option ID must be unique." });
        } else {
          seenOptionIds.add(optionId);
        }
        if (!optionText) {
          errors.push({ path: `${optionPath}.text`, message: "Option text is required." });
        }
        if (optionId && optionText) {
          normalizedOptions.push({ id: optionId, text: optionText });
        }
      });
    }

    const correctOptionsValue = question.correctOptions;
    if (!Array.isArray(correctOptionsValue) || correctOptionsValue.length === 0) {
      errors.push({
        path: `${path}.correctOptions`,
        message: "Correct Option(s) must be a non-empty array.",
      });
    }

    const normalizedCorrectOptions: string[] = [];
    if (Array.isArray(correctOptionsValue)) {
      correctOptionsValue.forEach((entryValue, correctIndex) => {
        const value = asString(entryValue);
        if (!value) {
          errors.push({
            path: `${path}.correctOptions[${correctIndex}]`,
            message: "Correct option value must be a non-empty string.",
          });
          return;
        }
        normalizedCorrectOptions.push(value);
      });
    }

    const optionIds = new Set(normalizedOptions.map((item) => item.id));
    normalizedCorrectOptions.forEach((optionId, correctIndex) => {
      if (!optionIds.has(optionId)) {
        errors.push({
          path: `${path}.correctOptions[${correctIndex}]`,
          message: "Correct option must reference an existing option ID.",
        });
      }
    });

    if (type === "single_choice" && normalizedCorrectOptions.length !== 1) {
      errors.push({
        path: `${path}.correctOptions`,
        message: "Single-choice questions require exactly one correct option.",
      });
    }

    if (type === "multiple_choice" && normalizedCorrectOptions.length < 1) {
      errors.push({
        path: `${path}.correctOptions`,
        message: "Multiple-choice questions require at least one correct option.",
      });
    }

    const hasBlockingError = errors.some((error) => error.path.startsWith(path));
    if (
      !hasBlockingError &&
      id &&
      prompt &&
      category &&
      (type === "single_choice" || type === "multiple_choice")
    ) {
      normalizedQuestions.push({
        id,
        question: prompt,
        auxiliaryInformation: optionalAux || undefined,
        questionType: type,
        options: normalizedOptions,
        correctOptions: normalizedCorrectOptions,
        correctAnswerExplanation: optionalExplanation || undefined,
        questionCategory: category,
        questionSubcategory: optionalSubcategory || undefined,
        questionSource: optionalSource || undefined,
        analytics: { ...DEFAULT_ANALYTICS },
      });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const collection: QuestionCollection = {
    version: "1",
    importedAt: new Date().toISOString(),
    questions: normalizedQuestions,
    summary: buildQuestionCollectionSummary(normalizedQuestions),
  };

  return { ok: true, collection };
}

export function getCollectionValidationErrorPreview(errors: ValidationIssue[], limit = 6) {
  return errors.slice(0, Math.max(1, limit));
}
