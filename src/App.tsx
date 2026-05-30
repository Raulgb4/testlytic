import { useMemo, useState } from "react";
import { AppShell } from "./app/AppShell";
import { SectionId } from "./app/navigation";
import { MockAnswerHistoryRow, MockCompletedAttempt } from "./features/analytics/analyticsTypes";
import { MOCK_ANSWER_HISTORY, MOCK_COMPLETED_ATTEMPTS } from "./features/analytics/mockAnalytics";
import { createTranslator, Language } from "./i18n";

type ThemeMode = "dark" | "light";

function App() {
  const [section, setSection] = useState<SectionId>("test");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [language, setLanguage] = useState<Language>("English");
  const [completedAttempts, setCompletedAttempts] =
    useState<MockCompletedAttempt[]>(MOCK_COMPLETED_ATTEMPTS);
  const [answerHistory, setAnswerHistory] = useState<MockAnswerHistoryRow[]>(MOCK_ANSWER_HISTORY);

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
      answerHistory={answerHistory}
      onDeleteAllAnswers={() => setAnswerHistory([])}
      onDeleteAllCompletedTests={() => setCompletedAttempts([])}
    />
  );
}

export default App;
