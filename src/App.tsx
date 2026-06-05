import { useMemo, useState } from "react";
import { AppShell } from "./app/AppShell";
import { SectionId } from "./app/navigation";
import { QuestionCollection, ValidationIssue } from "./features/test/questionCollectionTypes";
import {
  buildQuestionCollectionSummary,
  validateQuestionCollectionJson,
} from "./features/test/questionCollectionValidation";
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

  const t = useMemo(() => createTranslator(language), [language]);

  const importCollectionFile = async (file: File, merge = false) => {
    const raw = await file.text();
    const validation = validateQuestionCollectionJson(raw);
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      return false;
    }

    if (merge && collection) {
      const existingIds = new Set(collection.questions.map((question) => question.id));
      const duplicateErrors = validation.collection.questions
        .filter((question) => existingIds.has(question.id))
        .map((question) => ({
          path: `questions.${question.id}`,
          message: "Question ID already exists in the current question bank.",
        }));

      if (duplicateErrors.length > 0) {
        setValidationErrors(duplicateErrors);
        return false;
      }

      const mergedQuestions = [...collection.questions, ...validation.collection.questions];
      setCollection({
        version: collection.version,
        importedAt: new Date().toISOString(),
        questions: mergedQuestions,
        summary: buildQuestionCollectionSummary(mergedQuestions),
      });
      setValidationErrors([]);
      return true;
    }

    setCollection(validation.collection);
    setValidationErrors([]);
    return true;
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
      onImportCollectionFile={importCollectionFile}
      onClearValidationErrors={() => setValidationErrors([])}
      onResetQuestionBank={() => {
        setCollection(null);
        setValidationErrors([]);
      }}
      completedAttempts={completedAttempts}
      onAddCompletedAttempt={(attempt) => setCompletedAttempts((current) => [attempt, ...current])}
      onDeleteAllCompletedTests={() => setCompletedAttempts([])}
    />
  );
}

export default App;
