import { useId, useRef } from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { ImportProcessingState } from "./questionCollectionImport";
import { ValidationIssue } from "./questionCollectionTypes";

export function QuestionCollectionOnboarding({
  t,
  errors,
  importProcessing,
  onDownloadTemplate,
  onImportFile,
}: {
  t: Translator;
  errors: ValidationIssue[];
  importProcessing: ImportProcessingState;
  onDownloadTemplate: () => void | Promise<void>;
  onImportFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const hasErrors = errors.length > 0;
  const importBusy = isImportBusy(importProcessing.stage);

  return (
    <div className="collection-onboarding-wrap">
      <section className="collection-onboarding-card" aria-labelledby="collection-onboarding-title">
        <h3 id="collection-onboarding-title">{t("test.collectionOnboardingTitle")}</h3>
        <p className="placeholder-note">{t("test.collectionOnboardingSubtitle")}</p>

        <ol className="collection-workflow">
          <li>{t("test.collectionWorkflowStep1")}</li>
          <li>{t("test.collectionWorkflowStep2")}</li>
          <li>{t("test.collectionWorkflowStep3")}</li>
          <li>{t("test.collectionWorkflowStep4")}</li>
        </ol>
      </section>

      <div className="collection-actions" aria-label={t("test.collectionActionsLabel")}>
        <Button variant="secondary" onClick={() => void onDownloadTemplate()} disabled={importBusy}>
          {t("test.downloadTemplate")}
        </Button>
        <Button onClick={() => inputRef.current?.click()} disabled={importBusy}>
          {t("test.importCollection")}
        </Button>
      </div>

      <ImportStatus t={t} importProcessing={importProcessing} />

      <input
        id={inputId}
        ref={inputRef}
        className="collection-file-input"
        type="file"
        accept="application/json,.json"
        disabled={importBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImportFile(file);
          event.currentTarget.value = "";
        }}
      />

      {hasErrors ? <ImportErrors t={t} errors={errors} /> : null}
    </div>
  );
}

export function isImportBusy(stage: ImportProcessingState["stage"]) {
  return stage !== "idle" && stage !== "done" && stage !== "error";
}

export function ImportStatus({
  t,
  importProcessing,
}: {
  t: Translator;
  importProcessing: ImportProcessingState;
}) {
  if (importProcessing.stage === "idle") return null;

  return (
    <div className="collection-import-status" role="status" aria-live="polite">
      <span>{t(`questionBank.importStage.${importProcessing.stage}`)}</span>
      {importProcessing.isLargeFile ? (
        <span className="collection-import-warning">
          {t("questionBank.importLargeFileWarning")}
        </span>
      ) : null}
    </div>
  );
}

export function ImportErrors({ t, errors }: { t: Translator; errors: ValidationIssue[] }) {
  const visibleErrors = errors.slice(0, 10);
  const affectedQuestions = new Set(
    errors
      .map((error) => error.questionIndex)
      .filter((index): index is number => typeof index === "number"),
  ).size;
  const likelyCapped = errors.length >= 100;

  return (
    <div className="collection-errors" role="alert" aria-live="polite">
      <p className="collection-errors-title">{t("test.importErrorsTitle")}</p>
      <p className="collection-errors-summary">
        {t("questionBank.importErrorSummary", {
          count: errors.length,
          questions: affectedQuestions,
        })}
      </p>
      <p className="collection-errors-summary">{t("questionBank.importNoQuestionsChanged")}</p>
      <ul className="collection-errors-list">
        {visibleErrors.map((error) => (
          <li key={`${error.path}-${error.code}-${error.message}`}>
            <strong>{error.path}</strong>: {error.message}
          </li>
        ))}
      </ul>
      {errors.length > visibleErrors.length ? (
        <p className="collection-errors-more">
          {t("test.importErrorsMore", {
            shown: visibleErrors.length,
            total: errors.length,
          })}
        </p>
      ) : null}
      {likelyCapped ? (
        <p className="collection-errors-more">{t("questionBank.importErrorsCapped")}</p>
      ) : null}
    </div>
  );
}
