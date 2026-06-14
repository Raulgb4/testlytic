import { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { Translator } from "../../../app/types";
import { SearchableMultiSelect } from "../components/SearchableMultiSelect";

export type TestFormState = {
  title: string;
  questionLimit: number;
  includedCategories: string[];
  includedSubcategories: string[];
  allowUnanswered: boolean;
  timeLimitEnabled: boolean;
  negativeMarkingEnabled: boolean;
  penaltyPerIncorrectAnswer: number;
  timeLimitMinutes: number;
};

export type TestDefinitionFormValidation = {
  errors: {
    title?: string;
    questionLimit?: string;
    includedCategories?: string;
    timeLimitMinutes?: string;
    penaltyPerIncorrectAnswer?: string;
  };
  summary: string[];
  matchingCount: number;
  limitWarning: string;
  order: readonly [
    "title",
    "questionLimit",
    "includedCategories",
    "timeLimitMinutes",
    "penaltyPerIncorrectAnswer",
  ];
};

export function TestDefinitionFormModal({
  t,
  editingTestId,
  formState,
  setFormState,
  saveDefinition,
  showErrors,
  formValidation,
  categoryOptions,
  subcategoryOptions,
  updateIncludedCategories,
  titleInputRef,
  questionLimitInputRef,
  categoriesTriggerRef,
  timeLimitInputRef,
  penaltyInputRef,
  onCancel,
}: {
  t: Translator;
  editingTestId: string | null;
  formState: TestFormState;
  setFormState: Dispatch<SetStateAction<TestFormState>>;
  saveDefinition: (event: FormEvent<HTMLFormElement>) => void;
  showErrors: boolean;
  formValidation: TestDefinitionFormValidation;
  categoryOptions: string[];
  subcategoryOptions: string[];
  updateIncludedCategories: (next: string[]) => void;
  titleInputRef: RefObject<HTMLInputElement | null>;
  questionLimitInputRef: RefObject<HTMLInputElement | null>;
  categoriesTriggerRef: RefObject<HTMLButtonElement | null>;
  timeLimitInputRef: RefObject<HTMLInputElement | null>;
  penaltyInputRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
}) {
  return (
    <div className="settings-modal-backdrop" role="presentation">
      <div
        className="settings-modal test-definition-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-definition-title"
      >
        <h3 id="test-definition-title">
          {editingTestId ? t("test.editTest") : t("test.createTest")}
        </h3>
        <form className="test-definition-form" onSubmit={saveDefinition} noValidate>
          <div className="test-definition-body">
            <section className="test-form-section">
              <h4>{t("test.sectionBasics")}</h4>
              <label className="field">
                <span>{t("test.modalTitle")}</span>
                <input
                  ref={titleInputRef}
                  className="input"
                  value={formState.title}
                  onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                  aria-invalid={showErrors && Boolean(formValidation.errors.title)}
                />
                {showErrors && formValidation.errors.title ? (
                  <small className="field-error">{formValidation.errors.title}</small>
                ) : null}
              </label>

              <label className="field">
                <span>{t("test.questionLimit")}</span>
                <input
                  ref={questionLimitInputRef}
                  className="input"
                  type="number"
                  min={1}
                  value={formState.questionLimit}
                  onChange={(event) =>
                    setFormState({
                      ...formState,
                      questionLimit: Number(event.target.value || 1),
                    })
                  }
                  aria-invalid={showErrors && Boolean(formValidation.errors.questionLimit)}
                />
                {showErrors && formValidation.errors.questionLimit ? (
                  <small className="field-error">{formValidation.errors.questionLimit}</small>
                ) : null}
                {formValidation.matchingCount > 0 ? (
                  <small className="field-hint">
                    {t("test.matchingCount", { count: formValidation.matchingCount })}
                  </small>
                ) : null}
                {formValidation.limitWarning ? (
                  <small className="field-warning">{formValidation.limitWarning}</small>
                ) : null}
              </label>
            </section>

            <section className="test-form-section">
              <h4>{t("test.sectionFilters")}</h4>
              <SearchableMultiSelect
                label={t("test.includedCategories")}
                placeholder={t("test.searchCategories")}
                options={categoryOptions}
                selected={formState.includedCategories}
                onChange={updateIncludedCategories}
                triggerRef={categoriesTriggerRef}
                error={showErrors ? formValidation.errors.includedCategories : undefined}
                selectedCountLabel={t("test.selectedCount", {
                  count: formState.includedCategories.length,
                })}
                clearLabel={t("test.clearAll")}
                selectAllLabel={t("test.selectAllCategories")}
                onSelectAll={() => updateIncludedCategories(categoryOptions)}
                closeLabel={t("test.close")}
              />

              <SearchableMultiSelect
                label={t("test.includedSubcategoriesOptional")}
                placeholder={t("test.searchSubcategories")}
                options={subcategoryOptions}
                selected={formState.includedSubcategories}
                onChange={(next) => setFormState({ ...formState, includedSubcategories: next })}
                disabled={formState.includedCategories.length === 0}
                disabledText={t("test.selectCategoryFirst")}
                selectedCountLabel={t("test.selectedCount", {
                  count: formState.includedSubcategories.length,
                })}
                clearLabel={t("test.clearAll")}
                selectAllLabel={t("test.selectAllCategories")}
                onSelectAll={() =>
                  setFormState({ ...formState, includedSubcategories: subcategoryOptions })
                }
                closeLabel={t("test.close")}
              />
            </section>

            <section className="test-form-section">
              <h4>{t("test.sectionTimingScoring")}</h4>
              <label className="field-inline">
                <input
                  type="checkbox"
                  checked={formState.allowUnanswered}
                  onChange={(event) =>
                    setFormState({ ...formState, allowUnanswered: event.target.checked })
                  }
                />
                <span>{t("test.allowUnanswered")}</span>
              </label>

              <label className="field-inline">
                <input
                  type="checkbox"
                  checked={formState.timeLimitEnabled}
                  onChange={(event) =>
                    setFormState({ ...formState, timeLimitEnabled: event.target.checked })
                  }
                />
                <span>{t("test.enableTimeLimit")}</span>
              </label>

              <div
                className={formState.timeLimitEnabled ? "penalty-reveal show" : "penalty-reveal"}
              >
                <label className="field">
                  <span>{t("test.timeLimit")}</span>
                  <input
                    ref={timeLimitInputRef}
                    className="input"
                    type="number"
                    min={1}
                    value={formState.timeLimitMinutes}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        timeLimitMinutes: Number(event.target.value || 0),
                      })
                    }
                    aria-invalid={showErrors && Boolean(formValidation.errors.timeLimitMinutes)}
                  />
                  {showErrors && formValidation.errors.timeLimitMinutes ? (
                    <small className="field-error">{formValidation.errors.timeLimitMinutes}</small>
                  ) : null}
                </label>
              </div>

              <label className="field-inline">
                <input
                  type="checkbox"
                  checked={formState.negativeMarkingEnabled}
                  onChange={(event) =>
                    setFormState({ ...formState, negativeMarkingEnabled: event.target.checked })
                  }
                />
                <span>{t("test.negativeMarking")}</span>
              </label>

              <div
                className={
                  formState.negativeMarkingEnabled ? "penalty-reveal show" : "penalty-reveal"
                }
              >
                <label className="field">
                  <span>{t("test.penaltyPerIncorrectAnswer")}</span>
                  <input
                    ref={penaltyInputRef}
                    className="input"
                    type="number"
                    min={0}
                    step={0.05}
                    value={formState.penaltyPerIncorrectAnswer}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        penaltyPerIncorrectAnswer: Number(event.target.value || 0),
                      })
                    }
                    aria-invalid={
                      showErrors && Boolean(formValidation.errors.penaltyPerIncorrectAnswer)
                    }
                  />
                  {showErrors && formValidation.errors.penaltyPerIncorrectAnswer ? (
                    <small className="field-error">
                      {formValidation.errors.penaltyPerIncorrectAnswer}
                    </small>
                  ) : null}
                </label>
              </div>
            </section>
          </div>

          {showErrors && formValidation.summary.length > 0 ? (
            <div className="form-error-summary" role="alert" aria-live="polite">
              <p>{t("test.fixFieldsBeforeSave", { count: formValidation.summary.length })}</p>
            </div>
          ) : null}

          <footer className="test-definition-footer">
            <button type="button" className="btn btn-secondary modal-action-btn" onClick={onCancel}>
              {t("test.cancel")}
            </button>
            <button type="submit" className="btn btn-primary modal-action-btn">
              {t("test.saveTest")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
