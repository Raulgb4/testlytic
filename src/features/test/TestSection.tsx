import { FormEvent, RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
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
import { ActiveTestAttempt, CompletedTestAttempt, RuntimeAnswer, RuntimeQueueItem, TestAttempt, TestDefinition } from "./testTypes";
import { buildRuntimeQuestions, calculateAttemptResult, getCategoryOptions, getMatchingQuestions, getSubcategoryOptions, isExactSetMatch } from "./testUtils";

type TestFormState = {
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
  title: "",
  questionLimit: 20,
  includedCategories: [],
  includedSubcategories: [],
  allowUnanswered: true,
  negativeMarkingEnabled: false,
  penaltyPerIncorrectAnswer: 0.25,
  timeLimitMinutes: 30,
};

export function TestSection({
  t,
  onCompletedAttempt,
}: {
  t: Translator;
  onCompletedAttempt: (attempt: CompletedTestAttempt) => void;
}) {
  const importMoreInputId = useId();
  const importMoreInputRef = useRef<HTMLInputElement | null>(null);
  const [collection, setCollection] = useState<QuestionCollection | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [toast, setToast] = useState<null | { message: string; variant: "success" | "error" }>(null);
  const [definitions, setDefinitions] = useState<TestDefinition[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<TestFormState>(INITIAL_FORM);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const questionLimitInputRef = useRef<HTMLInputElement | null>(null);
  const categoriesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const timeLimitInputRef = useRef<HTMLInputElement | null>(null);
  const penaltyInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestDefinition | null>(null);
  const [importMoreOpen, setImportMoreOpen] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<ActiveTestAttempt | null>(null);
  const [resultAttempt, setResultAttempt] = useState<{ result: TestAttempt; definition: TestDefinition } | null>(null);
  const [finishWarning, setFinishWarning] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activeAttempt) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt]);

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
    setFormTouched(false);
    setFormState({
      ...INITIAL_FORM,
      questionLimit: Math.min(20, Math.max(1, bankQuestions.length)),
      includedCategories: categoryOptions.length > 0 ? [categoryOptions[0]] : [],
    });
    setFormOpen(true);
  };

  const openEdit = (definition: TestDefinition) => {
    setEditingTestId(definition.id);
    setFormTouched(false);
    setFormState({
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

  const formValidation = validateDefinitionForm(formState, bankQuestions);
  const showErrors = formTouched;

  const saveDefinition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormTouched(true);
    if (formValidation.summary.length > 0) {
      const firstError = formValidation.order.find((key) => Boolean(formValidation.errors[key]));
      if (firstError === "title") titleInputRef.current?.focus();
      if (firstError === "questionLimit") questionLimitInputRef.current?.focus();
      if (firstError === "includedCategories") categoriesTriggerRef.current?.focus();
      if (firstError === "timeLimitMinutes") timeLimitInputRef.current?.focus();
      if (firstError === "penaltyPerIncorrectAnswer") penaltyInputRef.current?.focus();
      return;
    }

    const now = new Date().toISOString();
    const generatedId = `test-${Date.now()}`;
    const payload: TestDefinition = {
      id: editingTestId || generatedId,
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
      queue: runtimeQuestions.map((question, index) => ({
        queueId: `${question.id}-attempt-1-${index}`,
        sourceQuestionId: question.id,
        retryNumber: 0,
        question,
      })),
      originalQuestionCount: runtimeQuestions.length,
      submittedAnswers: {},
      draftSelections: {},
      currentQueueIndex: 0,
    };
    setFinishWarning("");
    setResultAttempt(null);
    setActiveAttempt(nextAttempt);
  };

  const selectDraftAnswer = (queueItem: RuntimeQueueItem, optionId: string) => {
    if (!activeAttempt) return;
    if (activeAttempt.submittedAnswers[queueItem.queueId]) return;

    const current = activeAttempt.draftSelections[queueItem.queueId] || [];
    let selectedOptionIds = current;
    if (queueItem.question.questionType === "single_choice") {
      selectedOptionIds = [optionId];
    } else {
      selectedOptionIds = selectedOptionIds.includes(optionId)
        ? selectedOptionIds.filter((id) => id !== optionId)
        : [...selectedOptionIds, optionId];
    }

    setActiveAttempt({
      ...activeAttempt,
      draftSelections: {
        ...activeAttempt.draftSelections,
        [queueItem.queueId]: selectedOptionIds,
      },
    });
    setFinishWarning("");
  };

  const submitCurrentAnswer = () => {
    if (!activeAttempt) return;
    const queueItem = activeAttempt.queue[activeAttempt.currentQueueIndex];
    if (!queueItem || activeAttempt.submittedAnswers[queueItem.queueId]) return;
    const selectedOptionIds = activeAttempt.draftSelections[queueItem.queueId] || [];
    if (selectedOptionIds.length === 0) return;

    const isCorrect = isExactSetMatch(selectedOptionIds, queueItem.question.correctOptions);
    const runtimeAnswer: RuntimeAnswer = {
      selectedOptionIds,
      isCorrect,
      answeredAt: new Date().toISOString(),
      attemptNumber: queueItem.retryNumber + 1,
    };

    const nextSubmittedAnswers = {
      ...activeAttempt.submittedAnswers,
      [queueItem.queueId]: runtimeAnswer,
    };
    const nextQueue = isCorrect
      ? activeAttempt.queue
      : [
          ...activeAttempt.queue,
          {
            ...queueItem,
            queueId: `${queueItem.sourceQuestionId}-attempt-${Date.now()}-${activeAttempt.queue.length}`,
            retryNumber: queueItem.retryNumber + 1,
          },
        ];

    setActiveAttempt({
      ...activeAttempt,
      queue: nextQueue,
      submittedAnswers: nextSubmittedAnswers,
    });
    setFinishWarning("");
  };

  const finishActiveTest = () => {
    if (!activeAttempt) return;
    const definition = definitions.find((item) => item.id === activeAttempt.testId);
    if (!definition) return;
    const unansweredCount = activeAttempt.queue.filter(
      (queueItem) => !activeAttempt.submittedAnswers[queueItem.queueId],
    ).length;
    if (!definition.allowUnanswered && unansweredCount > 0) {
      setFinishWarning(t("test.finishWarning", { count: unansweredCount }));
      return;
    }
    const result = calculateAttemptResult(activeAttempt, definition);
    setResultAttempt({ result, definition });
    onCompletedAttempt(result);
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
    const currentQueueItem = activeAttempt.queue[activeAttempt.currentQueueIndex];
    const currentQuestion = currentQueueItem.question;
    const currentAnswer = activeAttempt.submittedAnswers[currentQueueItem.queueId];
    const currentDraft = activeAttempt.draftSelections[currentQueueItem.queueId] || [];
    const submittedAnswers = Object.values(activeAttempt.submittedAnswers).filter(Boolean);
    const correctCount = submittedAnswers.filter((answer) => answer?.isCorrect).length;
    const wrongCount = submittedAnswers.filter((answer) => answer && !answer.isCorrect).length;
    const answeredCount = submittedAnswers.length;
    const activeDefinition = definitions.find((item) => item.id === activeAttempt.testId);
    const elapsedSeconds = Math.max(
      0,
      Math.floor((nowMs - new Date(activeAttempt.startedAt).getTime()) / 1000),
    );
    const visibleQuestionPosition = Math.min(activeAttempt.currentQueueIndex + 1, activeAttempt.originalQuestionCount);
    const visibleCategory = currentQuestion.questionSubcategory
      ? `${currentQuestion.questionCategory} / ${currentQuestion.questionSubcategory}`
      : currentQuestion.questionCategory;

    return (
      <div className="test-runner-full">
        <section className="test-status-bar" aria-label={t("test.activeTitle")}>
          <div className="test-status-title">
            <h3>{activeDefinition?.title || t("test.activeTitle")}</h3>
            <p>{visibleCategory}</p>
          </div>
          <MetricLine label={t("test.statusQuestion")} value={`${visibleQuestionPosition}/${activeAttempt.originalQuestionCount}`} />
          <MetricLine label={t("test.statusCorrect")} value={String(correctCount)} />
          <MetricLine label={t("test.statusWrong")} value={String(wrongCount)} />
          <MetricLine label={t("test.statusAnswered")} value={`${answeredCount}/${activeAttempt.queue.length}`} />
          <MetricLine label={t("test.statusElapsed")} value={formatDuration(elapsedSeconds)} />
          <MetricLine
            label={t("test.statusLimit")}
            value={activeDefinition && activeDefinition.timeLimitMinutes > 0
              ? t("test.limitMinutes", { minutes: activeDefinition.timeLimitMinutes })
              : t("test.noTimeLimit")}
          />
        </section>

        <Card title={t("test.questionTitle", { number: activeAttempt.currentQueueIndex + 1 })} className="test-runner-card">
          <p className="runner-question">{currentQuestion.question}</p>
          {currentQuestion.auxiliaryInformation ? (
            <p className="runner-note">{currentQuestion.auxiliaryInformation}</p>
          ) : null}
          <div className="runner-options" role="group" aria-label={t("test.answerOptions")}>
            {currentQuestion.options.map((option, optionIndex) => {
              const selected = currentDraft.includes(option.id) || currentAnswer?.selectedOptionIds.includes(option.id) || false;
              const hasAnswer = Boolean(currentAnswer);
              const isCorrectOption = currentQuestion.correctOptions.includes(option.id);
              let className = "runner-option";
              if (selected) className += " selected";
              if (hasAnswer) {
                if (isCorrectOption) className += " correct";
                if (selected && !isCorrectOption) className += " incorrect";
              }
              return (
                <button key={option.id} type="button" className={className} onClick={() => selectDraftAnswer(currentQueueItem, option.id)}>
                  <span className="option-key">{getVisibleOptionLabel(optionIndex)}</span>
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>

          <div className="test-runner-footer">
            {activeAttempt.currentQueueIndex > 0 ? (
              <Button variant="secondary" onClick={() => setActiveAttempt({ ...activeAttempt, currentQueueIndex: Math.max(0, activeAttempt.currentQueueIndex - 1) })}>{t("test.previous")}</Button>
            ) : null}
            {!currentAnswer ? (
              <Button onClick={submitCurrentAnswer} disabled={currentDraft.length === 0}>{t("test.answer")}</Button>
            ) : null}
            {currentAnswer && activeAttempt.currentQueueIndex < activeAttempt.queue.length - 1 ? (
              <Button variant="secondary" onClick={() => setActiveAttempt({ ...activeAttempt, currentQueueIndex: Math.min(activeAttempt.queue.length - 1, activeAttempt.currentQueueIndex + 1) })}>{t("test.next")}</Button>
            ) : null}
            <Button onClick={finishActiveTest}>{t("test.finish")}</Button>
          </div>
        </Card>
        {finishWarning ? <p className="field-error runner-finish-warning">{finishWarning}</p> : null}
      </div>
    );
  }

  if (resultAttempt) {
    const { result, definition } = resultAttempt;
    return (
      <div className="view-grid results-view">
        <Card title={t("test.finalGrade")} subtitle={definition.title} className="results-hero-card">
          <p className="results-grade">{result.gradeOutOf10.toFixed(1)} / 10</p>
          <div className="results-meta-line">
            <span>{t("test.completedFriendly", { value: formatDateTime(result.completedAt) })}</span>
            <span>{t("test.kpiDuration")}: {formatDuration(result.durationSeconds)}</span>
          </div>
        </Card>

        <Card title={t("test.resultsTitle")} subtitle={t("test.resultsSubtitle") } className="results-summary-card">
          <div className="kpi-grid results-kpi-grid">
            <MetricLine label={t("test.finalScoreFriendly")} value={`${result.finalScore.toFixed(2)}`} />
            <MetricLine label={t("test.kpiAccuracy")} value={`${result.accuracyPercentage.toFixed(2)}%`} />
            <MetricLine label={t("test.kpiCorrect")} value={String(result.correctAnswers)} />
            <MetricLine label={t("test.kpiIncorrect")} value={String(result.incorrectAnswers)} />
            <MetricLine label={t("test.kpiUnanswered")} value={String(result.unansweredQuestions)} />
            <MetricLine label={t("test.kpiDuration")} value={formatDuration(result.durationSeconds)} />
          </div>
          <div className="retry-summary">
            <MetricLine label={t("test.retryAttempts")} value={String(result.retryAttempts)} />
            <MetricLine label={t("test.retryCorrect")} value={String(result.retryCorrectAnswers)} />
            <MetricLine label={t("test.retryWrong")} value={String(result.retryIncorrectAnswers)} />
          </div>
          <p className="placeholder-note">{t("test.retryLearningNote")}</p>
          <div className="results-return-action">
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
                      <p className="saved-test-meta">
                        {t("test.savedTestMeta", {
                          questions: definition.questionLimit,
                          categories: definition.includedCategories.length,
                          time: definition.timeLimitMinutes > 0
                            ? t("test.savedTestTimeLimit", { minutes: definition.timeLimitMinutes })
                            : t("test.savedTestNoTimeLimit"),
                          negative: definition.negativeMarkingEnabled
                            ? t("test.savedTestNegativeOn")
                            : t("test.savedTestNegativeOff"),
                          matching: matchingCount,
                        })}
                      </p>
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
          <div className="settings-modal test-definition-modal" role="dialog" aria-modal="true" aria-labelledby="test-definition-title">
            <h3 id="test-definition-title">{editingTestId ? t("test.editTest") : t("test.createTest")}</h3>
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
                    {showErrors && formValidation.errors.title ? <small className="field-error">{formValidation.errors.title}</small> : null}
                  </label>

                  <label className="field">
                    <span>{t("test.questionLimit")}</span>
                    <input
                      ref={questionLimitInputRef}
                      className="input"
                      type="number"
                      min={1}
                      value={formState.questionLimit}
                      onChange={(event) => setFormState({ ...formState, questionLimit: Number(event.target.value || 1) })}
                      aria-invalid={showErrors && Boolean(formValidation.errors.questionLimit)}
                    />
                    {showErrors && formValidation.errors.questionLimit ? <small className="field-error">{formValidation.errors.questionLimit}</small> : null}
                    {formValidation.matchingCount > 0 ? (
                      <small className="field-hint">{t("test.matchingCount", { count: formValidation.matchingCount })}</small>
                    ) : null}
                    {formValidation.limitWarning ? <small className="field-warning">{formValidation.limitWarning}</small> : null}
                  </label>
                </section>

                <section className="test-form-section">
                  <h4>{t("test.sectionFilters")}</h4>
                  <SearchableMultiSelect
                    label={t("test.includedCategories")}
                    placeholder={t("test.searchCategories")}
                    options={categoryOptions}
                    selected={formState.includedCategories}
                    onChange={(next) => {
                      const allowedSubcategories = getSubcategoryOptions(bankQuestions, next);
                      setFormState({
                        ...formState,
                        includedCategories: next,
                        includedSubcategories: formState.includedSubcategories.filter((item) =>
                          allowedSubcategories.includes(item),
                        ),
                      });
                    }}
                    triggerRef={categoriesTriggerRef}
                    error={showErrors ? formValidation.errors.includedCategories : undefined}
                    selectedCountLabel={t("test.selectedCount", { count: formState.includedCategories.length })}
                    clearLabel={t("test.clearAll")}
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
                    selectedCountLabel={t("test.selectedCount", { count: formState.includedSubcategories.length })}
                    clearLabel={t("test.clearAll")}
                    closeLabel={t("test.close")}
                  />
                </section>

                <section className="test-form-section">
                  <h4>{t("test.sectionTimingScoring")}</h4>
                  <label className="field">
                    <span>{t("test.timeLimit")}</span>
                    <input
                      ref={timeLimitInputRef}
                      className="input"
                      type="number"
                      min={0}
                      value={formState.timeLimitMinutes}
                      onChange={(event) => setFormState({ ...formState, timeLimitMinutes: Number(event.target.value || 0) })}
                      aria-invalid={showErrors && Boolean(formValidation.errors.timeLimitMinutes)}
                    />
                    {showErrors && formValidation.errors.timeLimitMinutes ? <small className="field-error">{formValidation.errors.timeLimitMinutes}</small> : null}
                  </label>

                  <label className="field-inline">
                    <input
                      type="checkbox"
                      checked={formState.allowUnanswered}
                      onChange={(event) => setFormState({ ...formState, allowUnanswered: event.target.checked })}
                    />
                    <span>{t("test.allowUnanswered")}</span>
                  </label>

                  <label className="field-inline">
                    <input
                      type="checkbox"
                      checked={formState.negativeMarkingEnabled}
                      onChange={(event) => setFormState({ ...formState, negativeMarkingEnabled: event.target.checked })}
                    />
                    <span>{t("test.negativeMarking")}</span>
                  </label>

                  <div className={formState.negativeMarkingEnabled ? "penalty-reveal show" : "penalty-reveal"}>
                    <label className="field">
                      <span>{t("test.penaltyPerIncorrectAnswer")}</span>
                      <input
                        ref={penaltyInputRef}
                        className="input"
                        type="number"
                        min={0}
                        step={0.05}
                        value={formState.penaltyPerIncorrectAnswer}
                        onChange={(event) => setFormState({ ...formState, penaltyPerIncorrectAnswer: Number(event.target.value || 0) })}
                        aria-invalid={showErrors && Boolean(formValidation.errors.penaltyPerIncorrectAnswer)}
                      />
                      {showErrors && formValidation.errors.penaltyPerIncorrectAnswer ? <small className="field-error">{formValidation.errors.penaltyPerIncorrectAnswer}</small> : null}
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
                <button type="button" className="btn btn-secondary modal-action-btn" onClick={() => setFormOpen(false)}>
                  {t("test.cancel")}
                </button>
                <button type="submit" className="btn btn-primary modal-action-btn">
                  {t("test.saveTest")}
                </button>
              </footer>
            </form>
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

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainingSeconds = safe % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString();
}

function getVisibleOptionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function validateDefinitionForm(
  form: TestFormState,
  bankQuestions: CollectionQuestion[],
) {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!Number.isInteger(form.questionLimit) || form.questionLimit < 1) {
    errors.questionLimit = "Question limit must be at least 1.";
  }
  if (form.includedCategories.length === 0) {
    errors.includedCategories = "Select at least one category.";
  }
  if (form.timeLimitMinutes < 0) {
    errors.timeLimitMinutes = "Time limit cannot be negative.";
  }
  if (form.negativeMarkingEnabled && form.penaltyPerIncorrectAnswer < 0) {
    errors.penaltyPerIncorrectAnswer = "Penalty cannot be negative.";
  }

  const testDefinition: TestDefinition = {
    id: "temp-id",
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
  if (matchingCount < 1) errors.includedCategories = "No questions match your filters.";

  const summary = Object.values(errors);
  const limitWarning =
    matchingCount > 0 && form.questionLimit > matchingCount
      ? `Only ${matchingCount} matching questions are currently available.`
      : "";

  return {
    errors: {
      title: errors.title,
      questionLimit: errors.questionLimit,
      includedCategories: errors.includedCategories,
      timeLimitMinutes: errors.timeLimitMinutes,
      penaltyPerIncorrectAnswer: errors.penaltyPerIncorrectAnswer,
    },
    summary,
    matchingCount,
    limitWarning,
    order: [
      "title",
      "questionLimit",
      "includedCategories",
      "timeLimitMinutes",
      "penaltyPerIncorrectAnswer",
    ] as const,
  };
}

function SearchableMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  selectedCountLabel,
  clearLabel,
  closeLabel,
  disabled,
  disabledText,
  error,
  triggerRef,
}: {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  selectedCountLabel: string;
  clearLabel: string;
  closeLabel: string;
  disabled?: boolean;
  disabledText?: string;
  error?: string;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter((item) => item.toLowerCase().includes(query.toLowerCase()));

  const toggleSelection = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <div className="field multi-select-field">
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="input multi-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {selected.length > 0 ? selectedCountLabel : placeholder}
      </button>

      {open && !disabled ? (
        <div className="multi-select-panel">
          <input
            className="input multi-select-search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="multi-select-options">
            {filtered.map((option) => (
              <label key={option} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleSelection(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <div className="multi-select-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onChange([])}>
              {clearLabel}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              {closeLabel}
            </button>
          </div>
        </div>
      ) : null}

      {disabled && disabledText ? <small className="field-hint">{disabledText}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}
