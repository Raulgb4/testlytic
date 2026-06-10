import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./app/AppShell";
import { SectionId } from "./app/navigation";
import {
  buildUpdatedQuestionCollection,
  findDuplicateQuestions,
  ImportCollectionResult,
  ImportConflictResolution,
  ImportProcessingState,
  PendingImportConflict,
} from "./features/test/questionCollectionImport";
import {
  QuestionAnalytics,
  QuestionCollection,
  ValidationIssue,
} from "./features/test/questionCollectionTypes";
import { validateQuestionCollectionJson } from "./features/test/questionCollectionValidation";
import {
  CompletedTestAttempt,
  ActiveTestAttempt,
  RuntimeAnswer,
  RuntimeQueueItem,
  TestDefinition,
} from "./features/test/testTypes";
import { createTranslator, Language } from "./i18n";
import {
  deleteAllCompletedAttempts,
  deleteTestDefinition,
  generateTestQuestions,
  getActiveTestAttempt,
  getPreferences,
  getQuestionCollection,
  importQuestionCollection,
  listCompletedAttempts,
  listTestDefinitions,
  resetQuestionBank,
  saveCompletedAttempt,
  saveActiveTestAttempt,
  saveTestDefinition,
  setPreference,
  updateQuestionDifficulty as persistQuestionDifficulty,
  clearActiveTestAttempt,
  ActiveTestRecovery,
  QuestionExposureUpdate,
} from "./services/persistence";

type ThemeMode = "dark" | "light";
const SOFT_LARGE_IMPORT_BYTES = 10 * 1024 * 1024;
const HARD_IMPORT_BYTES = 100 * 1024 * 1024;

function yieldToUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function buildFileTooLargeIssue(fileSize: number): ValidationIssue {
  return {
    severity: "error",
    path: "file",
    code: "file.tooLarge",
    message: `This JSON file is ${(fileSize / 1024 / 1024).toFixed(1)} MB. The safe import limit is ${HARD_IMPORT_BYTES / 1024 / 1024} MB.`,
  };
}

function App() {
  const [section, setSection] = useState<SectionId>("test");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [language, setLanguage] = useState<Language>("English");
  const [completedAttempts, setCompletedAttempts] = useState<CompletedTestAttempt[]>([]);
  const [collection, setCollection] = useState<QuestionCollection | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [definitions, setDefinitions] = useState<TestDefinition[]>([]);
  const [pendingActiveRecovery, setPendingActiveRecovery] = useState<ActiveTestRecovery | null>(
    null,
  );
  const [activeRecoveryLoadError, setActiveRecoveryLoadError] = useState(false);
  const [pendingImportConflict, setPendingImportConflict] = useState<PendingImportConflict | null>(
    null,
  );
  const [importProcessing, setImportProcessing] = useState<ImportProcessingState>({
    stage: "idle",
  });

  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [
          preferences,
          persistedCollection,
          persistedDefinitions,
          persistedAttempts,
          persistedActiveRecovery,
        ] = await Promise.all([
          getPreferences(),
          getQuestionCollection(),
          listTestDefinitions(),
          listCompletedAttempts(),
          getActiveTestAttempt().catch((error) => {
            console.error("Failed to load active test recovery", error);
            return "corrupt" as const;
          }),
        ]);

        if (cancelled) return;
        setLanguage(preferences.language);
        setTheme(preferences.theme);
        setCollection(persistedCollection);
        setDefinitions(persistedDefinitions);
        setCompletedAttempts(persistedAttempts);
        if (persistedActiveRecovery === "corrupt") {
          setActiveRecoveryLoadError(true);
        } else {
          setPendingActiveRecovery(persistedActiveRecovery);
        }
      } catch (error) {
        console.error("Failed to hydrate persisted state", error);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPersistedLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    void setPreference("language", nextLanguage);
  };

  const setPersistedTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    void setPreference("theme", nextTheme);
  };

  const importCollectionFile = async (
    file: File,
    merge = false,
  ): Promise<ImportCollectionResult> => {
    const isLargeFile = file.size >= SOFT_LARGE_IMPORT_BYTES;
    setPendingImportConflict(null);
    setValidationErrors([]);

    if (file.size > HARD_IMPORT_BYTES) {
      setImportProcessing({ stage: "error", isLargeFile });
      setValidationErrors([buildFileTooLargeIssue(file.size)]);
      return { status: "invalid" };
    }

    try {
      setImportProcessing({ stage: "reading", isLargeFile });
      await yieldToUi();
      const raw = await file.text();

      setImportProcessing({ stage: "parsing", isLargeFile });
      await yieldToUi();

      setImportProcessing({ stage: "validating", isLargeFile });
      await yieldToUi();
      const validation = validateQuestionCollectionJson(raw);
      if (!validation.ok) {
        setImportProcessing({ stage: "error", isLargeFile });
        setValidationErrors(validation.errors);
        return { status: "invalid" };
      }

      setImportProcessing({ stage: "checkingDuplicates", isLargeFile });
      await yieldToUi();
      if (merge && collection) {
        const duplicateQuestions = findDuplicateQuestions(
          collection.questions,
          validation.collection.questions,
        );
        if (duplicateQuestions.length > 0) {
          setPendingImportConflict({
            incomingCollection: validation.collection,
            duplicateQuestions,
          });
          setImportProcessing({ stage: "done", isLargeFile });
          return { status: "conflict", duplicateQuestions };
        }
      }

      setImportProcessing({ stage: "persisting", isLargeFile });
      await yieldToUi();
      const result = await importQuestionCollection(validation.collection, merge);
      if (result.status === "conflict") {
        setPendingImportConflict({
          incomingCollection: validation.collection,
          duplicateQuestions: result.duplicateQuestions,
        });
        setImportProcessing({ stage: "done", isLargeFile });
        return { status: "conflict", duplicateQuestions: result.duplicateQuestions };
      }

      setCollection(result.collection);
      setPendingImportConflict(null);
      setValidationErrors([]);
      setImportProcessing({ stage: "done", isLargeFile });
      return { status: "imported" };
    } catch (error) {
      console.error("Failed to import question collection", error);
      setImportProcessing({ stage: "error", isLargeFile });
      setValidationErrors([
        {
          severity: "error",
          path: "import",
          code: "import.failed",
          message: "The question bank could not be imported. No questions were changed.",
        },
      ]);
      return { status: "invalid" };
    }
  };

  const resolveImportConflict = async (resolution: ImportConflictResolution) => {
    if (!pendingImportConflict) return { status: "cancelled" } as const;

    const result = await importQuestionCollection(
      pendingImportConflict.incomingCollection,
      true,
      resolution,
    );
    if (result.status !== "imported") return { status: "cancelled" } as const;

    setCollection(result.collection);
    setValidationErrors([]);
    setPendingImportConflict(null);
    return { status: "imported" } as const;
  };

  const cancelImportConflict = () => {
    setPendingImportConflict(null);
    return { status: "cancelled" } as const;
  };

  const updateQuestionDifficulty = (
    questionId: string,
    difficulty: QuestionAnalytics["userDeclaredDifficulty"],
  ) => {
    setCollection((current) => {
      if (!current) return current;

      let changed = false;
      const nextQuestions = current.questions.map((question) => {
        if (question.id !== questionId) return question;
        if (question.analytics.userDeclaredDifficulty === difficulty) return question;

        changed = true;
        return {
          ...question,
          analytics: {
            ...question.analytics,
            userDeclaredDifficulty: difficulty,
          },
        };
      });

      return changed ? buildUpdatedQuestionCollection(current, nextQuestions) : current;
    });
    void persistQuestionDifficulty(questionId, difficulty);
  };

  const applyQuestionExposureUpdates = (updates: QuestionExposureUpdate[]) => {
    if (updates.length === 0) return;

    setCollection((current) => {
      if (!current) return current;

      const exposureByQuestionId = new Map(
        updates.map((update) => [update.questionId, update.exposureCount]),
      );
      let changed = false;
      const nextQuestions = current.questions.map((question) => {
        const nextExposureCount = exposureByQuestionId.get(question.id);
        if (
          nextExposureCount === undefined ||
          question.analytics.exposureCount === nextExposureCount
        ) {
          return question;
        }

        changed = true;
        return {
          ...question,
          analytics: {
            ...question.analytics,
            exposureCount: nextExposureCount,
          },
        };
      });

      return changed ? buildUpdatedQuestionCollection(current, nextQuestions) : current;
    });
  };

  const saveDefinition = async (definition: TestDefinition) => {
    await saveTestDefinition(definition);
    setDefinitions((current) => {
      if (current.some((item) => item.id === definition.id)) {
        return current.map((item) => (item.id === definition.id ? definition : item));
      }
      return [definition, ...current];
    });
  };

  const removeDefinition = async (definition: TestDefinition) => {
    await deleteTestDefinition(definition.id);
    setDefinitions((current) => current.filter((item) => item.id !== definition.id));
  };

  const addCompletedAttempt = async (
    attempt: CompletedTestAttempt,
    queue: RuntimeQueueItem[],
    submittedAnswers: Record<string, RuntimeAnswer | undefined>,
  ) => {
    const exposureUpdates = await saveCompletedAttempt(attempt, queue, submittedAnswers);
    applyQuestionExposureUpdates(exposureUpdates);
    setCompletedAttempts((current) => [attempt, ...current]);
  };

  const persistActiveRecovery = (definition: TestDefinition, activeAttempt: ActiveTestAttempt) => {
    void saveActiveTestAttempt({
      id: activeAttempt.id,
      testDefinition: definition,
      activeAttempt,
      savedAt: new Date().toISOString(),
      appVersion: "0.1.0",
    });
  };

  const discardActiveRecovery = () => {
    void clearActiveTestAttempt();
    setPendingActiveRecovery(null);
    setActiveRecoveryLoadError(false);
  };

  return (
    <AppShell
      t={t}
      section={section}
      setSection={setSection}
      theme={theme}
      setTheme={setPersistedTheme}
      language={language}
      setLanguage={setPersistedLanguage}
      collection={collection}
      definitions={definitions}
      onSaveDefinition={(definition) => void saveDefinition(definition)}
      onDeleteDefinition={(definition) => void removeDefinition(definition)}
      onGenerateQuestions={(definition) => generateTestQuestions(definition)}
      pendingActiveRecovery={pendingActiveRecovery}
      activeRecoveryLoadError={activeRecoveryLoadError}
      onSaveActiveRecovery={persistActiveRecovery}
      onClearActiveRecovery={() => {
        void clearActiveTestAttempt();
        setPendingActiveRecovery(null);
        setActiveRecoveryLoadError(false);
      }}
      onDiscardActiveRecovery={discardActiveRecovery}
      validationErrors={validationErrors}
      importProcessing={importProcessing}
      pendingImportConflict={pendingImportConflict}
      onImportCollectionFile={importCollectionFile}
      onClearValidationErrors={() => setValidationErrors([])}
      onResolveImportConflict={resolveImportConflict}
      onCancelImportConflict={cancelImportConflict}
      onResetQuestionBank={() => {
        void resetQuestionBank();
        void clearActiveTestAttempt();
        setPendingActiveRecovery(null);
        setActiveRecoveryLoadError(false);
        setCollection(null);
        setValidationErrors([]);
        setPendingImportConflict(null);
      }}
      completedAttempts={completedAttempts}
      onAddCompletedAttempt={(attempt, queue, submittedAnswers) =>
        void addCompletedAttempt(attempt, queue, submittedAnswers)
      }
      onDeleteAllCompletedTests={() => {
        void deleteAllCompletedAttempts().then(() => {
          setCompletedAttempts([]);
          setCollection((current) => {
            if (!current) return current;

            let changed = false;
            const nextQuestions = current.questions.map((question) => {
              if (question.analytics.exposureCount === 0) return question;

              changed = true;
              return {
                ...question,
                analytics: {
                  ...question.analytics,
                  exposureCount: 0,
                },
              };
            });

            return changed ? buildUpdatedQuestionCollection(current, nextQuestions) : current;
          });
        });
      }}
      onUpdateQuestionDifficulty={updateQuestionDifficulty}
    />
  );
}

export default App;
