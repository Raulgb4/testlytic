import { useId, useRef } from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { ValidationIssue } from "./questionCollectionTypes";

export function QuestionCollectionOnboarding({
  t,
  errors,
  onDownloadTemplate,
  onImportFile,
}: {
  t: Translator;
  errors: ValidationIssue[];
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const hasErrors = errors.length > 0;
  const visibleErrors = errors.slice(0, 6);

  return (
    <div className="collection-onboarding-wrap">
      <section className="collection-onboarding-card" aria-labelledby="collection-onboarding-title">
        <h3 id="collection-onboarding-title">{t("test.collectionOnboardingTitle")}</h3>
        <p className="placeholder-note">{t("test.collectionOnboardingSubtitle")}</p>

        <div className="card-actions">
          <Button variant="secondary" onClick={onDownloadTemplate}>
            {t("test.downloadTemplate")}
          </Button>
          <Button onClick={() => inputRef.current?.click()}>{t("test.importCollection")}</Button>
        </div>

        <input
          id={inputId}
          ref={inputRef}
          className="collection-file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportFile(file);
            event.currentTarget.value = "";
          }}
        />

        {hasErrors ? (
          <div className="collection-errors" role="alert" aria-live="polite">
            <p className="collection-errors-title">{t("test.importErrorsTitle")}</p>
            <ul className="collection-errors-list">
              {visibleErrors.map((error) => (
                <li key={`${error.path}-${error.message}`}>
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
          </div>
        ) : null}
      </section>
    </div>
  );
}
