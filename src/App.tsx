import { useMemo, useState } from "react";
import { AppShell } from "./app/AppShell";
import { SectionId } from "./app/navigation";
import {
  buildUpdatedQuestionCollection,
  findDuplicateQuestions,
  ImportCollectionResult,
  ImportConflictResolution,
  importQuestionsAsCopies,
  PendingImportConflict,
  replaceExistingQuestions,
} from "./features/test/questionCollectionImport";
import {
  QuestionAnalytics,
  QuestionCollection,
  ValidationIssue,
} from "./features/test/questionCollectionTypes";
import { validateQuestionCollectionJson } from "./features/test/questionCollectionValidation";
import { CompletedTestAttempt, TestDefinition } from "./features/test/testTypes";
import { createTranslator, Language } from "./i18n";

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

    if (merge && collection) {
      const duplicateQuestions = findDuplicateQuestions(
        collection.questions,
        validation.collection.questions,
      );

      if (duplicateQuestions.length > 0) {
        setValidationErrors([]);
        setPendingImportConflict({
          incomingCollection: validation.collection,
          duplicateQuestions,
        });
        return { status: "conflict", duplicateQuestions };
      }

      const mergedQuestions = [...collection.questions, ...validation.collection.questions];
      setCollection(buildUpdatedQuestionCollection(collection, mergedQuestions));
      setPendingImportConflict(null);
      setValidationErrors([]);
      return { status: "imported" };
    }

    setCollection(validation.collection);
    setPendingImportConflict(null);
    setValidationErrors([]);
    return { status: "imported" };
  };

  const resolveImportConflict = (resolution: ImportConflictResolution) => {
    if (!collection || !pendingImportConflict) return { status: "cancelled" } as const;

    const nextQuestions =
      resolution === "replaceExisting"
        ? replaceExistingQuestions(
            collection.questions,
            pendingImportConflict.incomingCollection.questions,
          )
        : importQuestionsAsCopies(
            collection.questions,
            pendingImportConflict.incomingCollection.questions,
          );

    setCollection(buildUpdatedQuestionCollection(collection, nextQuestions));
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
  };

  return (
    <AppShell
      t={t}
      section={section}
      setSection={setSection}
      theme={theme}
      setTheme={setTheme}
      language={language}
      setLanguage={setLanguage}
      collection={collection}
      definitions={definitions}
      setDefinitions={setDefinitions}
      validationErrors={validationErrors}
      pendingImportConflict={pendingImportConflict}
      onImportCollectionFile={importCollectionFile}
      onClearValidationErrors={() => setValidationErrors([])}
      onResolveImportConflict={resolveImportConflict}
      onCancelImportConflict={cancelImportConflict}
      onResetQuestionBank={() => {
        setCollection(null);
        setValidationErrors([]);
        setPendingImportConflict(null);
      }}
      completedAttempts={completedAttempts}
      onAddCompletedAttempt={(attempt) => setCompletedAttempts((current) => [attempt, ...current])}
      onDeleteAllCompletedTests={() => setCompletedAttempts([])}
      onUpdateQuestionDifficulty={updateQuestionDifficulty}
    />
  );
}

export default App;
