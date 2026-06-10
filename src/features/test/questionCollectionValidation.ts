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
  exposureCount: 0,
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

function normalizeFingerprintString(value?: string) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export type QuestionCollectionValidationOptions = {
  maxErrors?: number;
};

const DEFAULT_MAX_ERRORS = 100;

function getLineColumn(raw: string, position: number) {
  let line = 1;
  let column = 1;
  for (let index = 0; index < raw.length && index < position; index += 1) {
    if (raw[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function getJsonParseIssue(raw: string, error: unknown): ValidationIssue {
  const message = error instanceof Error ? error.message : "Unknown parse error.";
  const positionMatch = message.match(/position (\d+)/i);
  const lineColumnMatch = message.match(/line (\d+) column (\d+)/i);

  if (lineColumnMatch) {
    const line = Number(lineColumnMatch[1]);
    const column = Number(lineColumnMatch[2]);
    return {
      severity: "error",
      path: "root",
      code: "json.invalid",
      message: `Invalid JSON format near line ${line}, column ${column}. Check for missing commas, trailing commas, unclosed strings, or invalid quotes.`,
    };
  }

  if (positionMatch) {
    const { line, column } = getLineColumn(raw, Number(positionMatch[1]));
    return {
      severity: "error",
      path: "root",
      code: "json.invalid",
      message: `Invalid JSON format near line ${line}, column ${column}. Check for missing commas, trailing commas, unclosed strings, or invalid quotes.`,
    };
  }

  return {
    severity: "error",
    path: "root",
    code: "json.invalid",
    message:
      "Invalid JSON format. Check for missing commas, trailing commas, unclosed strings, or invalid quotes.",
  };
}

export function buildQuestionContentFingerprint(
  question: Pick<
    CollectionQuestion,
    | "question"
    | "auxiliaryInformation"
    | "questionType"
    | "options"
    | "correctOptions"
    | "correctAnswerExplanation"
    | "questionCategory"
    | "questionSubcategory"
    | "questionSource"
  >,
) {
  return hashString(
    JSON.stringify({
      question: normalizeFingerprintString(question.question),
      auxiliaryInformation: normalizeFingerprintString(question.auxiliaryInformation),
      questionType: question.questionType,
      options: question.options.map((option) => ({
        id: normalizeFingerprintString(option.id),
        text: normalizeFingerprintString(option.text),
      })),
      correctOptions: [...question.correctOptions].map(normalizeFingerprintString).sort(),
      correctAnswerExplanation: normalizeFingerprintString(question.correctAnswerExplanation),
      questionCategory: normalizeFingerprintString(question.questionCategory),
      questionSubcategory: normalizeFingerprintString(question.questionSubcategory),
      questionSource: normalizeFingerprintString(question.questionSource),
    }),
  );
}

export function generateInternalQuestionId(fingerprint: string, usedIds: Set<string>) {
  const baseId = `q_${fingerprint}`;
  let nextId = baseId;
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${baseId}_${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
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

export function validateQuestionCollectionJson(
  raw: string,
  options: QuestionCollectionValidationOptions = {},
): ValidationResult {
  const maxErrors = Math.max(1, options.maxErrors ?? DEFAULT_MAX_ERRORS);
  let parsed: unknown;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  let errorLimitReached = false;

  const addError = (issue: Omit<ValidationIssue, "severity"> & { severity?: "error" }) => {
    if (errors.length >= maxErrors) {
      errorLimitReached = true;
      return;
    }
    errors.push({ ...issue, severity: "error" });
  };

  const addWarning = (issue: Omit<ValidationIssue, "severity">) => {
    warnings.push({ ...issue, severity: "warning" });
  };

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      errors: [getJsonParseIssue(raw, error)],
      warnings: [],
      errorLimitReached: false,
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: [
        {
          severity: "error",
          path: "root",
          code: "root.type",
          message: "Root must be an object matching the official Testlytic template.",
        },
      ],
      warnings: [],
      errorLimitReached: false,
    };
  }

  const input = parsed as Record<string, unknown>;

  if (input.version !== "1") {
    addError({ path: "version", code: "version.invalid", message: 'Version must be exactly "1".' });
  }

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    addError({
      path: "questions",
      code: "questions.invalid",
      message: "Questions must be a non-empty array.",
    });
  }

  if (errors.length > 0) return { ok: false, errors, warnings, errorLimitReached };

  const sourceQuestions = input.questions as unknown[];
  const usedQuestionIds = new Set<string>();
  const normalizedQuestions: CollectionQuestion[] = [];

  sourceQuestions.forEach((entry, index) => {
    if (errorLimitReached) return;
    const path = `questions[${index}]`;
    let questionHasError = false;
    const addQuestionError = (issue: Omit<ValidationIssue, "severity" | "questionIndex">) => {
      questionHasError = true;
      addError({ ...issue, questionIndex: index });
    };

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      addQuestionError({ path, code: "question.type", message: "Question must be an object." });
      return;
    }

    const question = entry as Record<string, unknown>;
    if ("id" in question) {
      addWarning({
        path: `${path}.id`,
        code: "question.idIgnored",
        questionIndex: index,
        message: "Question IDs are internal and will be ignored on import.",
      });
    }

    const prompt = asString(question.question);
    if (!prompt) {
      addQuestionError({
        path: `${path}.question`,
        code: "question.required",
        message: "Question text is required.",
      });
    } else if (typeof question.question !== "string") {
      addQuestionError({
        path: `${path}.question`,
        code: "question.type",
        message: "Question text must be a string.",
      });
    }

    const type = question.questionType;
    if (type !== "single_choice" && type !== "multiple_choice") {
      addQuestionError({
        path: `${path}.questionType`,
        code: "questionType.invalid",
        message: 'Question Type must be "single_choice" or "multiple_choice".',
      });
    }

    const category = asString(question.questionCategory);
    if (!category) {
      addQuestionError({
        path: `${path}.questionCategory`,
        code: "category.required",
        message: "Question Category is required.",
      });
    } else if (typeof question.questionCategory !== "string") {
      addQuestionError({
        path: `${path}.questionCategory`,
        code: "category.type",
        message: "Question Category must be a string.",
      });
    }

    const optionalAux = optionalString(question.auxiliaryInformation);
    const optionalExplanation = optionalString(question.correctAnswerExplanation);
    const optionalSubcategory = optionalString(question.questionSubcategory);
    const optionalSource = optionalString(question.questionSource);

    if (optionalAux === null) {
      addQuestionError({
        path: `${path}.auxiliaryInformation`,
        code: "auxiliaryInformation.type",
        message: "Auxiliary Information must be a string when provided.",
      });
    }
    if (optionalExplanation === null) {
      addQuestionError({
        path: `${path}.correctAnswerExplanation`,
        code: "correctAnswerExplanation.type",
        message: "Correct Answer Explanation must be a string when provided.",
      });
    }
    if (optionalSubcategory === null) {
      addQuestionError({
        path: `${path}.questionSubcategory`,
        code: "subcategory.type",
        message: "Question Subcategory must be a string when provided.",
      });
    }
    if (optionalSource === null) {
      addQuestionError({
        path: `${path}.questionSource`,
        code: "source.type",
        message: "Question Source must be a string when provided.",
      });
    }

    const optionsValue = question.options;
    if (!Array.isArray(optionsValue) || optionsValue.length < 2) {
      addQuestionError({
        path: `${path}.options`,
        code: "options.invalid",
        message: "Options must include at least 2 entries.",
      });
    }

    const normalizedOptions: { id: string; text: string }[] = [];
    const seenOptionIds = new Set<string>();
    if (Array.isArray(optionsValue)) {
      optionsValue.forEach((optionEntry, optionIndex) => {
        if (errorLimitReached) return;
        const optionPath = `${path}.options[${optionIndex}]`;
        const addOptionError = (
          issue: Omit<ValidationIssue, "severity" | "questionIndex" | "optionIndex">,
        ) => {
          questionHasError = true;
          addError({ ...issue, questionIndex: index, optionIndex });
        };
        if (!optionEntry || typeof optionEntry !== "object" || Array.isArray(optionEntry)) {
          addOptionError({
            path: optionPath,
            code: "option.type",
            message: "Option must be an object.",
          });
          return;
        }
        const option = optionEntry as Record<string, unknown>;
        const optionId = asString(option.id);
        const optionText = asString(option.text);
        if (!optionId) {
          addOptionError({
            path: `${optionPath}.id`,
            code: "option.idRequired",
            message: "Option ID is required.",
          });
        } else if (typeof option.id !== "string") {
          addOptionError({
            path: `${optionPath}.id`,
            code: "option.idType",
            message: "Option ID must be a string.",
          });
        } else if (seenOptionIds.has(optionId)) {
          addOptionError({
            path: `${optionPath}.id`,
            code: "option.idDuplicate",
            message: "Option ID must be unique within the question.",
          });
        } else {
          seenOptionIds.add(optionId);
        }
        if (!optionText) {
          addOptionError({
            path: `${optionPath}.text`,
            code: "option.textRequired",
            message: "Option text is required.",
          });
        } else if (typeof option.text !== "string") {
          addOptionError({
            path: `${optionPath}.text`,
            code: "option.textType",
            message: "Option text must be a string.",
          });
        }
        if (optionId && optionText) {
          normalizedOptions.push({ id: optionId, text: optionText });
        }
      });
    }

    const correctOptionsValue = question.correctOptions;
    if (!Array.isArray(correctOptionsValue) || correctOptionsValue.length === 0) {
      addQuestionError({
        path: `${path}.correctOptions`,
        code: "correctOptions.invalid",
        message: "Correct Option(s) must be a non-empty array.",
      });
    }

    const normalizedCorrectOptions: string[] = [];
    const seenCorrectOptions = new Set<string>();
    if (Array.isArray(correctOptionsValue)) {
      correctOptionsValue.forEach((entryValue, correctIndex) => {
        if (errorLimitReached) return;
        const value = asString(entryValue);
        if (!value) {
          addQuestionError({
            path: `${path}.correctOptions[${correctIndex}]`,
            code: "correctOptions.valueRequired",
            message: "Correct option value must be a non-empty string.",
          });
          return;
        }
        if (typeof entryValue !== "string") {
          addQuestionError({
            path: `${path}.correctOptions[${correctIndex}]`,
            code: "correctOptions.valueType",
            message: "Correct option value must be a string.",
          });
          return;
        }
        if (seenCorrectOptions.has(value)) {
          addQuestionError({
            path: `${path}.correctOptions[${correctIndex}]`,
            code: "correctOptions.duplicate",
            message: "Correct option values must be unique.",
          });
          return;
        }
        seenCorrectOptions.add(value);
        normalizedCorrectOptions.push(value);
      });
    }

    const optionIds = new Set(normalizedOptions.map((item) => item.id));
    normalizedCorrectOptions.forEach((optionId, correctIndex) => {
      if (!optionIds.has(optionId)) {
        addQuestionError({
          path: `${path}.correctOptions[${correctIndex}]`,
          code: "correctOptions.referenceMissing",
          message: "Correct option must reference an existing option ID.",
        });
      }
    });

    if (type === "single_choice" && normalizedCorrectOptions.length !== 1) {
      addQuestionError({
        path: `${path}.correctOptions`,
        code: "singleChoice.correctCount",
        message: "Single-choice questions require exactly one correct option.",
      });
    }

    if (type === "multiple_choice" && normalizedCorrectOptions.length < 1) {
      addQuestionError({
        path: `${path}.correctOptions`,
        code: "multipleChoice.correctCount",
        message: "Multiple-choice questions require at least one correct option.",
      });
    }

    if (
      !questionHasError &&
      prompt &&
      category &&
      (type === "single_choice" || type === "multiple_choice")
    ) {
      const questionFingerprint = buildQuestionContentFingerprint({
        question: prompt,
        auxiliaryInformation: optionalAux || undefined,
        questionType: type,
        options: normalizedOptions,
        correctOptions: normalizedCorrectOptions,
        correctAnswerExplanation: optionalExplanation || undefined,
        questionCategory: category,
        questionSubcategory: optionalSubcategory || undefined,
        questionSource: optionalSource || undefined,
      });

      normalizedQuestions.push({
        id: generateInternalQuestionId(questionFingerprint, usedQuestionIds),
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
    return { ok: false, errors, warnings, errorLimitReached };
  }

  const collection: QuestionCollection = {
    version: "1",
    importedAt: new Date().toISOString(),
    questions: normalizedQuestions,
    summary: buildQuestionCollectionSummary(normalizedQuestions),
  };

  return { ok: true, collection, warnings };
}

export function getCollectionValidationErrorPreview(errors: ValidationIssue[], limit = 6) {
  return errors.slice(0, Math.max(1, limit));
}
