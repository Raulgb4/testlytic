import { useState } from "react";
import { Translator } from "../../app/types";
import { Language } from "../../i18n";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Modal } from "../../shared/components/Modal";
import "./settings.css";

type ThemeMode = "dark" | "light";

export function SettingsSection({
  t,
  language,
  setLanguage,
  theme,
  setTheme,
  questionCount,
  answerCount,
  completedCount,
  onDeleteAllAnswers,
  onResetQuestionBank,
  onDeleteAllCompletedTests,
}: {
  t: Translator;
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  questionCount: number;
  answerCount: number;
  completedCount: number;
  onDeleteAllAnswers: () => void;
  onResetQuestionBank: () => void;
  onDeleteAllCompletedTests: () => void;
}) {
  const [confirmAction, setConfirmAction] = useState<null | "answers" | "questionBank" | "tests">(
    null,
  );
  const [dangerMessage, setDangerMessage] = useState("");
  const isDark = theme === "dark";

  const runDangerAction = () => {
    if (confirmAction === "answers") {
      onDeleteAllAnswers();
      setDangerMessage(t("settings.dangerAnswersDone"));
    }
    if (confirmAction === "tests") {
      onDeleteAllCompletedTests();
      setDangerMessage(t("settings.dangerTestsDone"));
    }
    if (confirmAction === "questionBank") {
      onResetQuestionBank();
      setDangerMessage(t("settings.dangerQuestionBankDone"));
    }
    setConfirmAction(null);
  };

  return (
    <div className="settings-layout">
      <Card title={t("settings.languageCardTitle")} subtitle={t("settings.languageCardSubtitle")}>
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
      </Card>

      <Card title={t("settings.themeCardTitle")} subtitle={t("settings.themeCardSubtitle")}>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={t("settings.themeSwitchLabel")}
          className={isDark ? "theme-switch active" : "theme-switch"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <span className="theme-switch-option">{t("settings.lightTheme")}</span>
          <span className="theme-switch-option">{t("settings.darkTheme")}</span>
          <span className="theme-switch-thumb" aria-hidden="true" />
        </button>
      </Card>

      <Card
        title={t("settings.dangerTitle")}
        subtitle={t("settings.dangerSubtitle")}
        className="settings-danger-card"
      >
        <div className="card-actions settings-danger-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setConfirmAction("answers");
              setDangerMessage("");
            }}
          >
            {t("settings.deleteAnswers")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setConfirmAction("questionBank");
              setDangerMessage("");
            }}
          >
            {t("settings.resetQuestionBank")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setConfirmAction("tests");
              setDangerMessage("");
            }}
          >
            {t("settings.deleteTests")}
          </button>
        </div>

        {dangerMessage ? <p className="placeholder-note">{dangerMessage}</p> : null}

        <p className="placeholder-note">
          {t("settings.counts", { answers: answerCount, tests: completedCount })}
        </p>
        <p className="placeholder-note">
          {t("settings.questionBankCount", { count: questionCount })}
        </p>
      </Card>

      <Card title={t("settings.aboutTitle")} subtitle={t("settings.aboutSubtitle")}>
        <div className="settings-about-rows">
          <div className="settings-about-row">
            <span>{t("settings.aboutDescriptionLabel")}</span>
            <p>{t("settings.aboutDescription")}</p>
          </div>
          <div className="settings-about-row">
            <span>{t("settings.aboutVersionLabel")}</span>
            <p>0.1.0</p>
          </div>
          <div className="settings-about-row">
            <span>{t("settings.aboutLicenseLabel")}</span>
            <p>MIT</p>
          </div>
          <div className="settings-about-row">
            <span>{t("settings.aboutAuthorLabel")}</span>
            <p>Raúl García Balongo</p>
          </div>
        </div>
      </Card>

      {confirmAction ? (
        <Modal
          title={t("settings.confirmModalTitle")}
          onClose={() => setConfirmAction(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>
                {t("test.cancel")}
              </Button>
              <Button variant="danger" onClick={runDangerAction}>
                {t("settings.confirm")}
              </Button>
            </>
          }
        >
          <p>
            {confirmAction === "answers"
              ? t("settings.confirmDeleteAnswers")
              : confirmAction === "questionBank"
                ? t("settings.confirmResetQuestionBank")
                : t("settings.confirmDeleteTests")}
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
