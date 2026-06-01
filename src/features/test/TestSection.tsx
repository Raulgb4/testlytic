import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Toast } from "../../shared/components/Toast";
import { saveQuestionCollectionTemplate } from "./questionCollectionTemplate";
import { QuestionCollectionOnboarding } from "./QuestionCollectionOnboarding";
import { CollectionQuestion, QuestionCollection, ValidationIssue } from "./questionCollectionTypes";
import {
  buildQuestionCollectionSummary,
  validateQuestionCollectionJson,
} from "./questionCollectionValidation";
import { ActiveTestAttempt, RuntimeAnswer, RuntimeQuestion, TestAttempt, TestDefinition } from "./testTypes";
import { buildRuntimeQuestions, calculateAttemptResult, getCategoryOptions, getMatchingQuestions, getSubcategoryOptions } from "./testUtils";

type TestFormState = {
  id: string;
  title: string;
  questionLimit: number;
  includedCategories: string[];
  includedSubcategories: string[];
  allowUnanswered: boolean;
  negativeMarkingEnabled: boolean;
  penaltyPerIncorrectAnswer: number;
  timeLimitMinutes: number;
};

const INITIAL_FORM: TestFormState = {
  id: "",
  title: "",
  questionLimit: 20,
  includedCategories: [],
  includedSubcategories: [],
  allowUnanswered: true,
  negativeMarkingEnabled: false,
  penaltyPerIncorrectAnswer: 0.25,
  timeLimitMinutes: 30,
};

export function TestSection({ t }: { t: Translator }) {
  const importMoreInputId = useId();
  const importMoreInputRef = useRef<HTMLInputElement | null>(null);
  const [collection, setCollection] = useState<QuestionCollection | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [toast, setToast] = useState<null | { message: string; variant: "success" | "error" }>(null);
  const [definitions, setDefinitions] = useState<TestDefinition[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<TestFormState>(INITIAL_FORM);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestDefinition | null>(null);
  const [importMoreOpen, setImportMoreOpen] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<ActiveTestAttempt | null>(null);
  const [resultAttempt, setResultAttempt] = useState<{ result: TestAttempt; definition: TestDefinition } | null>(null);
  const [finishWarning, setFinishWarning] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const bankQuestions = useMemo(() => collection?.questions || [], [collection]);
  const categoryOptions = useMemo(() => getCategoryOptions(bankQuestions), [bankQuestions]);
  const subcategoryOptions = useMemo(
    () => getSubcategoryOptions(bankQuestions, formState.includedCategories),
    [bankQuestions, formState.includedCategories],
  );

  const importCollectionFile = async (file: File) => {
    const raw = await file.text();
    const validation = validateQuestionCollectionJson(raw);
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      return;
    }
    if (importMoreOpen && collection) {
      const existingIds = new Set(collection.questions.map((question) => question.id));
      const duplicateErrors = validation.collection.questions
        .filter((question) => existingIds.has(question.id))
        .map((question) => ({
          path: `questions.${question.id}`,
          message: "Question ID already exists in the current question bank.",
        }));

      if (duplicateErrors.length > 0) {
        setValidationErrors(duplicateErrors);
        return;
      }

      const mergedQuestions = [...collection.questions, ...validation.collection.questions];
      setCollection({
        version: collection.version,
        importedAt: new Date().toISOString(),
        questions: mergedQuestions,
        summary: buildQuestionCollectionSummary(mergedQuestions),
      });
      setValidationErrors([]);
      setImportMoreOpen(false);
      return;
    }

    setCollection(validation.collection);
    setValidationErrors([]);
    setImportMoreOpen(false);
  };

  const handleDownloadTemplate = async () => {
    const result = await saveQuestionCollectionTemplate();
    if (result.status === "saved") {
      setToast({ message: t("test.templateSavedSuccess"), variant: "success" });
      return;
    }
    if (result.status === "error") {
      setToast({ message: t("test.templateSavedError"), variant: "error" });
    }
  };

  const openCreate = () => {
    setEditingTestId(null);
    setFormState({
      ...INITIAL_FORM,
      questionLimit: Math.min(20, Math.max(1, bankQuestions.length)),
      includedCategories: categoryOptions.length > 0 ? [categoryOptions[0]] : [],
    });
    setFormOpen(true);
  };

  const openEdit = (definition: TestDefinition) => {
    setEditingTestId(definition.id);
    setFormState({
      id: definition.id,
      title: definition.title,
      questionLimit: definition.questionLimit,
      includedCategories: definition.includedCategories,
      includedSubcategories: definition.includedSubcategories || [],
      allowUnanswered: definition.allowUnanswered,
      negativeMarkingEnabled: definition.negativeMarkingEnabled,
      penaltyPerIncorrectAnswer: definition.penaltyPerIncorrectAnswer,
      timeLimitMinutes: definition.timeLimitMinutes,
    });
    setFormOpen(true);
  };

  const formErrors = validateDefinitionForm(formState, definitions, editingTestId, bankQuestions);

  const saveDefinition = () => {
    if (formErrors.length > 0) return;
    const now = new Date().toISOString();
    const normalizedId = formState.id.trim();
    const payload: TestDefinition = {
      id: normalizedId,
      title: formState.title.trim(),
      questionLimit: formState.questionLimit,
      includedCategories: formState.includedCategories,
      includedSubcategories: formState.includedSubcategories,
      allowUnanswered: formState.allowUnanswered,
      negativeMarkingEnabled: formState.negativeMarkingEnabled,
      penaltyPerIncorrectAnswer: formState.negativeMarkingEnabled
        ? formState.penaltyPerIncorrectAnswer
        : 0,
      timeLimitMinutes: formState.timeLimitMinutes,
      createdAt: editingTestId
        ? definitions.find((item) => item.id === editingTestId)?.createdAt || now
        : now,
      updatedAt: now,
    };

    setDefinitions((current) => {
      if (editingTestId) {
        return current.map((item) => (item.id === editingTestId ? payload : item));
      }
      return [payload, ...current];
    });
    setFormOpen(false);
  };

  const runDefinition = (definition: TestDefinition) => {
    const runtimeQuestions = buildRuntimeQuestions(definition, bankQuestions);
    if (runtimeQuestions.length === 0) {
      setToast({ message: t("test.noMatchingQuestions"), variant: "error" });
      return;
    }
    const nextAttempt: ActiveTestAttempt = {
      id: `active-${Date.now()}`,
      testId: definition.id,
      startedAt: new Date().toISOString(),
      questions: runtimeQuestions,
      answers: {},
      currentQuestionIndex: 0,
    };
    setFinishWarning("");
    setResultAttempt(null);
    setActiveAttempt(nextAttempt);
  };

  const answerCurrent = (question: RuntimeQuestion, optionId: string) => {
    if (!activeAttempt) return;
    const current = activeAttempt.answers[question.id];
    let selectedOptionIds = current?.selectedOptionIds || [];
    if (question.questionType === "single_choice") {
      selectedOptionIds = [optionId];
    } else {
      selectedOptionIds = selectedOptionIds.includes(optionId)
        ? selectedOptionIds.filter((id) => id !== optionId)
        : [...selectedOptionIds, optionId];
    }
    const selectedSet = new Set(selectedOptionIds);
    const isCorrect =
      selectedOptionIds.length === question.correctOptions.length &&
      question.correctOptions.every((correctId) => selectedSet.has(correctId));
    const runtimeAnswer: RuntimeAnswer = {
      selectedOptionIds,
      isCorrect,
      answeredAt: new Date().toISOString(),
    };

    setActiveAttempt({
      ...activeAttempt,
      answers: {
        ...activeAttempt.answers,
        [question.id]: runtimeAnswer,
      },
    });
    setFinishWarning("");
  };

  const finishActiveTest = () => {
    if (!activeAttempt) return;
    const definition = definitions.find((item) => item.id === activeAttempt.testId);
    if (!definition) return;
    const unansweredCount = activeAttempt.questions.filter(
      (question) => !activeAttempt.answers[question.id] || activeAttempt.answers[question.id]?.selectedOptionIds.length === 0,
    ).length;
    if (!definition.allowUnanswered && unansweredCount > 0) {
      setFinishWarning(t("test.finishWarning", { count: unansweredCount }));
      return;
    }
    const result = calculateAttemptResult(activeAttempt, definition);
    setResultAttempt({ result, definition });
    setActiveAttempt(null);
  };

  if (!collection) {
    return (
      <>
        <QuestionCollectionOnboarding
          t={t}
          errors={validationErrors}
          onDownloadTemplate={handleDownloadTemplate}
          onImportFile={importCollectionFile}
        />
        {toast ? (
          <Toast
            message={toast.message}
            variant={toast.variant}
            onClose={() => setToast(null)}
            closeLabel={t("test.toastClose")}
          />
        ) : null}
      </>
    );
  }

  if (activeAttempt) {
    const currentQuestion = activeAttempt.questions[activeAttempt.currentQuestionIndex];
    const currentAnswer = activeAttempt.answers[currentQuestion.id];
    const answeredCount = activeAttempt.questions.filter(
      (question) => activeAttempt.answers[question.id] && activeAttempt.answers[question.id]?.selectedOptionIds.length,
    ).length;
    return (
      <div className="test-runner-full">
        <Card title={definitions.find((item) => item.id === activeAttempt.testId)?.title || t("test.activeTitle")}
          subtitle={t("test.activeSubtitleNew", {
            current: activeAttempt.currentQuestionIndex + 1,
            total: activeAttempt.questions.length,
          })}
          className="test-runner-card"
        >
          <div className="test-headline">
            <span className="tag">{t("test.answered", { count: answeredCount, total: activeAttempt.questions.length })}</span>
            <span className="tag">{currentQuestion.questionCategory}</span>
          </div>
          <p className="runner-question">{currentQuestion.question}</p>
          {currentQuestion.auxiliaryInformation ? <p className="runner-note">{currentQuestion.auxiliaryInformation}</p> : null}
          <div className="runner-options">
            {currentQuestion.options.map((option) => {
              const selected = currentAnswer?.selectedOptionIds.includes(option.id) || false;
              const hasAnswer = (currentAnswer?.selectedOptionIds.length || 0) > 0;
              const isCorrectOption = currentQuestion.correctOptions.includes(option.id);
              let className = "runner-option";
              if (selected) className += " selected";
              if (hasAnswer) {
                if (isCorrectOption) className += " correct";
                if (selected && !isCorrectOption) className += " incorrect";
              }
              return (
                <button key={option.id} type="button" className={className} onClick={() => answerCurrent(currentQuestion, option.id)}>
                  <span className="option-key">{option.id.toUpperCase()}</span>
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>
          {currentAnswer ? (
            <p className={currentAnswer.isCorrect ? "answer-feedback correct" : "answer-feedback incorrect"}>
              {currentAnswer.isCorrect ? t("test.instantCorrect") : t("test.instantIncorrect")}
            </p>
          ) : null}
          <div className="card-actions">
            <Button variant="secondary" onClick={() => setActiveAttempt({ ...activeAttempt, currentQuestionIndex: Math.max(0, activeAttempt.currentQuestionIndex - 1) })} disabled={activeAttempt.currentQuestionIndex === 0}>{t("test.previous")}</Button>
            <Button variant="secondary" onClick={() => setActiveAttempt({ ...activeAttempt, currentQuestionIndex: Math.min(activeAttempt.questions.length - 1, activeAttempt.currentQuestionIndex + 1) })} disabled={activeAttempt.currentQuestionIndex === activeAttempt.questions.length - 1}>{t("test.next")}</Button>
            <Button onClick={finishActiveTest}>{t("test.finish")}</Button>
          </div>
          {finishWarning ? <p className="field-error">{finishWarning}</p> : null}
        </Card>
      </div>
    );
  }

  if (resultAttempt) {
    const { result, definition } = resultAttempt;
    return (
      <div className="view-grid">
        <Card title={t("test.resultsTitle")} subtitle={definition.title}>
          <div className="bank-summary">
            <MetricLine label={t("test.startedAt")} value={result.startedAt} />
            <MetricLine label={t("test.completedAt")} value={result.completedAt} />
            <MetricLine label={t("test.durationSeconds")} value={String(result.durationSeconds)} />
            <MetricLine label={t("test.totalQuestionsLabel")} value={String(result.totalQuestions)} />
            <MetricLine label={t("test.correctAnswers")} value={String(result.correctAnswers)} />
            <MetricLine label={t("test.incorrectAnswers")} value={String(result.incorrectAnswers)} />
            <MetricLine label={t("test.unansweredQuestions")} value={String(result.unansweredQuestions)} />
            <MetricLine label={t("test.rawScore")} value={String(result.rawScore)} />
            <MetricLine label={t("test.finalScore")} value={String(result.finalScore)} />
            <MetricLine label={t("test.accuracyPercentage")} value={`${result.accuracyPercentage.toFixed(2)}%`} />
          </div>
          <div className="card-actions">
            <Button onClick={() => setResultAttempt(null)}>{t("test.returnToHome")}</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="view-grid test-home-grid">
      <div className="test-home-content">
        <div className="configure-cta-wrap">
          <button type="button" className="configure-cta" onClick={openCreate}>{t("test.configureNewTest")}</button>
        </div>

        <Card title={t("test.savedTests")} subtitle={t("test.workspaceSubtitle")} className="test-home-card saved-tests-card">
          <div className="saved-tests-section">
            {definitions.length === 0 ? <p className="placeholder-note">{t("test.noSavedTests")}</p> : null}
            <div className="saved-tests-list">
              {definitions.map((definition) => {
                const matchingCount = getMatchingQuestions(definition, collection.questions).length;
                return (
                  <article key={definition.id} className="saved-test-item">
                    <div>
                      <p className="saved-test-title">{definition.title}</p>
                      <p className="saved-test-meta">{definition.id} · {definition.questionLimit} · {matchingCount}</p>
                    </div>
                    <div className="saved-test-actions">
                      <Button onClick={() => runDefinition(definition)}>{t("test.run")}</Button>
                      <Button variant="secondary" onClick={() => openEdit(definition)}>{t("test.edit")}</Button>
                      <Button variant="secondary" onClick={() => setDeleteTarget(definition)}>{t("test.delete")}</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title={t("test.collectionSummaryTitle")} subtitle={t("test.collectionSummarySubtitle")} className="test-home-card question-summary-card">
          <div className="bank-summary">
            <MetricLine label={t("test.questions")} value={String(collection.summary.totalQuestions)} />
            <MetricLine label={t("test.topicCategories")} value={String(collection.summary.totalCategories)} />
            <MetricLine label={t("test.collectionSubcategories")} value={String(collection.summary.totalSubcategories)} />
            <MetricLine label={t("test.collectionSingleChoice")} value={String(collection.summary.totalSingleChoice)} />
            <MetricLine label={t("test.collectionMultipleChoice")} value={String(collection.summary.totalMultipleChoice)} />
            <MetricLine label={t("test.lastUpdated")} value={new Date(collection.importedAt).toLocaleString()} />
          </div>
          <div className="summary-import-action">
            <Button variant="secondary" onClick={() => setImportMoreOpen(true)}>{t("test.importMoreQuestions")}</Button>
          </div>
        </Card>
      </div>

      {formOpen ? (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal test-definition-modal" role="dialog" aria-modal="true">
            <h3>{editingTestId ? t("test.editTest") : t("test.createTest")}</h3>
            <div className="form-grid">
              <label className="field"><span>{t("test.testId")}</span><input className="input" value={formState.id} onChange={(event) => setFormState({ ...formState, id: event.target.value })} disabled={Boolean(editingTestId)} /></label>
              <label className="field"><span>{t("test.title")}</span><input className="input" value={formState.title} onChange={(event) => setFormState({ ...formState, title: event.target.value })} /></label>
              <label className="field"><span>{t("test.questionLimit")}</span><input className="input" type="number" min={1} value={formState.questionLimit} onChange={(event) => setFormState({ ...formState, questionLimit: Number(event.target.value || 1) })} /></label>
              <label className="field"><span>{t("test.timeLimit")}</span><input className="input" type="number" min={0} value={formState.timeLimitMinutes} onChange={(event) => setFormState({ ...formState, timeLimitMinutes: Number(event.target.value || 0) })} /></label>
            </div>
            <div className="category-picks">
              <p className="modal-subtitle">{t("test.includedCategories")}</p>
              <div className="chips-wrap">
                {categoryOptions.map((category) => {
                  const selected = formState.includedCategories.includes(category);
                  return (
                    <button key={category} type="button" className={selected ? "progress-chip current" : "progress-chip"} onClick={() => setFormState({ ...formState, includedCategories: selected ? formState.includedCategories.filter((item) => item !== category) : [...formState.includedCategories, category] })}>{category}</button>
                  );
                })}
              </div>
              <p className="modal-subtitle">{t("test.includedSubcategoriesOptional")}</p>
              <div className="chips-wrap">
                {subcategoryOptions.map((subcategory) => {
                  const selected = formState.includedSubcategories.includes(subcategory);
                  return (
                    <button key={subcategory} type="button" className={selected ? "progress-chip answered" : "progress-chip"} onClick={() => setFormState({ ...formState, includedSubcategories: selected ? formState.includedSubcategories.filter((item) => item !== subcategory) : [...formState.includedSubcategories, subcategory] })}>{subcategory}</button>
                  );
                })}
              </div>
            </div>
            <div className="form-grid">
              <label className="field-inline"><input type="checkbox" checked={formState.allowUnanswered} onChange={(event) => setFormState({ ...formState, allowUnanswered: event.target.checked })} /><span>{t("test.allowUnanswered")}</span></label>
              <label className="field-inline"><input type="checkbox" checked={formState.negativeMarkingEnabled} onChange={(event) => setFormState({ ...formState, negativeMarkingEnabled: event.target.checked })} /><span>{t("test.negativeMarking")}</span></label>
              <label className="field"><span>{t("test.penaltyPerIncorrectAnswer")}</span><input className="input" type="number" min={0} step={0.05} value={formState.penaltyPerIncorrectAnswer} disabled={!formState.negativeMarkingEnabled} onChange={(event) => setFormState({ ...formState, penaltyPerIncorrectAnswer: Number(event.target.value || 0) })} /></label>
            </div>
            {formErrors.length > 0 ? <p className="field-error">{formErrors[0]}</p> : null}
            <div className="settings-modal-actions">
              <Button onClick={saveDefinition} disabled={formErrors.length > 0}>{t("test.save")}</Button>
              <Button variant="secondary" onClick={() => setFormOpen(false)}>{t("test.cancel")}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal" role="dialog" aria-modal="true">
            <h3>{t("test.deleteTestConfirmTitle")}</h3>
            <p>{t("test.deleteTestConfirmBody", { title: deleteTarget.title })}</p>
            <div className="settings-modal-actions">
              <Button onClick={() => { setDefinitions((current) => current.filter((item) => item.id !== deleteTarget.id)); setDeleteTarget(null); }}>{t("settings.confirm")}</Button>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t("test.cancel")}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {importMoreOpen ? (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal import-more-modal" role="dialog" aria-modal="true">
            <h3>{t("test.importMoreQuestions")}</h3>
            <p>{t("test.importMoreDescription")}</p>

            <div className="import-more-actions" aria-label={t("test.collectionActionsLabel")}>
              <Button variant="secondary" onClick={() => void handleDownloadTemplate()}>
                {t("test.downloadTemplate")}
              </Button>
              <Button onClick={() => importMoreInputRef.current?.click()}>
                {t("test.importCollection")}
              </Button>
              <Button variant="secondary" onClick={() => {
                setImportMoreOpen(false);
                setValidationErrors([]);
              }}>
                {t("test.cancel")}
              </Button>
            </div>

            <input
              id={importMoreInputId}
              ref={importMoreInputRef}
              className="collection-file-input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCollectionFile(file);
                event.currentTarget.value = "";
              }}
            />

            {validationErrors.length > 0 ? (
              <div className="collection-errors import-more-errors" role="alert" aria-live="polite">
                <p className="collection-errors-title">{t("test.importErrorsTitle")}</p>
                <ul className="collection-errors-list">
                  {validationErrors.slice(0, 6).map((error) => (
                    <li key={`${error.path}-${error.message}`}>
                      <strong>{error.path}</strong>: {error.message}
                    </li>
                  ))}
                </ul>
                {validationErrors.length > 6 ? (
                  <p className="collection-errors-more">
                    {t("test.importErrorsMore", { shown: 6, total: validationErrors.length })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} closeLabel={t("test.toastClose")} />
      ) : null}
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-inline">
      <span className="metric-inline-label">{label}</span>
      <span className="metric-inline-value">{value}</span>
    </div>
  );
}

function validateDefinitionForm(
  form: TestFormState,
  definitions: TestDefinition[],
  editingTestId: string | null,
  bankQuestions: CollectionQuestion[],
) {
  const errors: string[] = [];
  if (!form.id.trim()) errors.push("ID is required.");
  if (!editingTestId && definitions.some((item) => item.id === form.id.trim())) {
    errors.push("ID must be unique.");
  }
  if (!form.title.trim()) errors.push("Title is required.");
  if (!Number.isInteger(form.questionLimit) || form.questionLimit < 1) {
    errors.push("Question limit must be at least 1.");
  }
  if (form.includedCategories.length === 0) errors.push("Select at least one category.");
  if (form.timeLimitMinutes < 0) errors.push("Time limit cannot be negative.");
  if (form.negativeMarkingEnabled && form.penaltyPerIncorrectAnswer < 0) {
    errors.push("Penalty cannot be negative.");
  }
  const testDefinition: TestDefinition = {
    id: form.id,
    title: form.title,
    questionLimit: form.questionLimit,
    includedCategories: form.includedCategories,
    includedSubcategories: form.includedSubcategories,
    allowUnanswered: form.allowUnanswered,
    negativeMarkingEnabled: form.negativeMarkingEnabled,
    penaltyPerIncorrectAnswer: form.penaltyPerIncorrectAnswer,
    timeLimitMinutes: form.timeLimitMinutes,
    createdAt: "",
    updatedAt: "",
  };
  const matchingCount = getMatchingQuestions(testDefinition, bankQuestions).length;
  if (matchingCount < 1) errors.push("No questions match your filters.");
  return errors;
}
