import { useState } from "react";
import { Translator } from "../../app/types";
import { Language } from "../../i18n";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";

type ThemeMode = "dark" | "light";

export function SettingsSection({
  t,
  language,
  setLanguage,
  theme,
  setTheme,
  answerCount,
  completedCount,
  onDeleteAllAnswers,
  onDeleteAllCompletedTests,
}: {
  t: Translator;
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  answerCount: number;
  completedCount: number;
  onDeleteAllAnswers: () => void;
  onDeleteAllCompletedTests: () => void;
}) {
  const [confirmAction, setConfirmAction] = useState<null | "answers" | "tests">(null);
  const [dangerMessage, setDangerMessage] = useState("");

  const runDangerAction = () => {
    if (confirmAction === "answers") {
      onDeleteAllAnswers();
      setDangerMessage(t("settings.dangerAnswersDone"));
    }
    if (confirmAction === "tests") {
      onDeleteAllCompletedTests();
      setDangerMessage(t("settings.dangerTestsDone"));
    }
    setConfirmAction(null);
  };

  return (
    <div className="view-grid">
      <Card title={t("settings.preferencesTitle")} subtitle={t("settings.preferencesSubtitle")}>
        <label className="field">
          <span>{t("settings.language")}</span>
          <select
            className="input"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            <option value="English">{t("settings.english")}</option>
            <option value="Spanish">{t("settings.spanish")}</option>
          </select>
        </label>

        <div className="card-actions">
          <Button
            variant={theme === "dark" ? "primary" : "secondary"}
            onClick={() => setTheme("dark")}
          >
            {t("settings.darkTheme")}
          </Button>
          <Button
            variant={theme === "light" ? "primary" : "secondary"}
            onClick={() => setTheme("light")}
          >
            {t("settings.lightTheme")}
          </Button>
        </div>
      </Card>

      <Card title={t("settings.dangerTitle")} subtitle={t("settings.dangerSubtitle")}>
        <div className="card-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmAction("answers");
              setDangerMessage("");
            }}
          >
            {t("settings.deleteAnswers")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmAction("tests");
              setDangerMessage("");
            }}
          >
            {t("settings.deleteTests")}
          </Button>
        </div>

        {confirmAction ? (
          <div className="confirm-card">
            <p className="placeholder-note">
              {confirmAction === "answers"
                ? t("settings.confirmDeleteAnswers")
                : t("settings.confirmDeleteTests")}
            </p>
            <div className="card-actions">
              <Button onClick={runDangerAction}>{t("settings.confirm")}</Button>
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>
                {t("test.cancel")}
              </Button>
            </div>
          </div>
        ) : null}

        {dangerMessage ? <p className="placeholder-note">{dangerMessage}</p> : null}

        <p className="placeholder-note">
          {t("settings.counts", { answers: answerCount, tests: completedCount })}
        </p>
      </Card>

      <Card title={t("settings.localDataTitle")} subtitle={t("settings.localDataSubtitle")}>
        <p className="placeholder-note">{t("settings.localDataNote")}</p>
      </Card>

      <Card title={t("settings.aboutTitle")} subtitle={t("settings.aboutSubtitle")}>
        <div className="mode-grid">
          <div className="pill">{t("settings.aboutApp")}</div>
          <div className="pill">{t("settings.aboutVersion")}</div>
          <div className="pill">{t("settings.aboutLicense")}</div>
          <div className="pill">{t("settings.aboutAuthor")}</div>
        </div>
        <p className="placeholder-note">{t("settings.aboutDescription")}</p>
      </Card>
    </div>
  );
}
