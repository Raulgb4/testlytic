import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./app/AppShell";
import { SectionId } from "./app/navigation";
import {
  buildUpdatedQuestionCollection,
  ImportCollectionResult,
  ImportConflictResolution,
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
  RuntimeAnswer,
  RuntimeQueueItem,
  TestDefinition,
} from "./features/test/testTypes";
import { createTranslator, Language } from "./i18n";
import {
  deleteAllCompletedAttempts,
  deleteTestDefinition,
  generateTestQuestions,
  getPreferences,
  getQuestionCollection,
  importQuestionCollection,
  listCompletedAttempts,
  listTestDefinitions,
  resetQuestionBank,
  saveCompletedAttempt,
  saveTestDefinition,
  setPreference,
  updateQuestionDifficulty as persistQuestionDifficulty,
} from "./services/persistence";

type ThemeMode = "dark" | "light";

function App() {
  const [section, setSection] = useState<SectionId>("test");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [language, setLanguage] = useState<Language>("English");
  const [completedAttempts, setCompletedAttempts] = useState<CompletedTestAttempt[]>([]);
  const [collection, setCollection] = useState<QuestionCollection | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [definitions, setDefinitions] = useState<TestDefinition[]>([]);
  const [pendingImportConflict, setPendingImportConflict] = useState<PendingImportConflict | null>(
    null,
  );

  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [preferences, persistedCollection, persistedDefinitions, persistedAttempts] =
          await Promise.all([
            getPreferences(),
            getQuestionCollection(),
            listTestDefinitions(),
            listCompletedAttempts(),
          ]);

        if (cancelled) return;
        setLanguage(preferences.language);
        setTheme(preferences.theme);
        setCollection(persistedCollection);
        setDefinitions(persistedDefinitions);
        setCompletedAttempts(persistedAttempts);
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
    const raw = await file.text();
    const validation = validateQuestionCollectionJson(raw);
    if (!validation.ok) {
      setPendingImportConflict(null);
      setValidationErrors(validation.errors);
      return { status: "invalid" };
    }

    const result = await importQuestionCollection(validation.collection, merge);
    if (result.status === "conflict") {
      setValidationErrors([]);
      setPendingImportConflict({
        incomingCollection: validation.collection,
        duplicateQuestions: result.duplicateQuestions,
      });
      return { status: "conflict", duplicateQuestions: result.duplicateQuestions };
    }

    setCollection(result.collection);
    setPendingImportConflict(null);
    setValidationErrors([]);
    return { status: "imported" };
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
    await saveCompletedAttempt(attempt, queue, submittedAnswers);
    setCompletedAttempts((current) => [attempt, ...current]);
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
      validationErrors={validationErrors}
      pendingImportConflict={pendingImportConflict}
      onImportCollectionFile={importCollectionFile}
      onClearValidationErrors={() => setValidationErrors([])}
      onResolveImportConflict={resolveImportConflict}
      onCancelImportConflict={cancelImportConflict}
      onResetQuestionBank={() => {
        void resetQuestionBank();
        setCollection(null);
        setValidationErrors([]);
        setPendingImportConflict(null);
      }}
      completedAttempts={completedAttempts}
      onAddCompletedAttempt={(attempt, queue, submittedAnswers) =>
        void addCompletedAttempt(attempt, queue, submittedAnswers)
      }
      onDeleteAllCompletedTests={() => {
        void deleteAllCompletedAttempts();
        setCompletedAttempts([]);
      }}
      onUpdateQuestionDifficulty={updateQuestionDifficulty}
    />
  );
}

export default App;
