import { useMemo, useState } from "react";
import { AppShell } from "./app/AppShell";
import { SectionId } from "./app/navigation";
import { CompletedTestAttempt } from "./features/test/testTypes";
import { createTranslator, Language } from "./i18n";

type ThemeMode = "dark" | "light";

function App() {
  const [section, setSection] = useState<SectionId>("test");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [language, setLanguage] = useState<Language>("English");
  const [completedAttempts, setCompletedAttempts] =
    useState<CompletedTestAttempt[]>([]);

  const t = useMemo(() => createTranslator(language), [language]);

  return (
    <AppShell
      t={t}
      section={section}
      setSection={setSection}
      theme={theme}
      setTheme={setTheme}
      language={language}
      setLanguage={setLanguage}
      completedAttempts={completedAttempts}
      onAddCompletedAttempt={(attempt) => setCompletedAttempts((current) => [attempt, ...current])}
      onDeleteAllCompletedTests={() => setCompletedAttempts([])}
    />
  );
}

export default App;
