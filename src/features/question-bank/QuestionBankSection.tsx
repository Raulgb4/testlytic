import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Toast } from "../../shared/components/Toast";
import { QuestionCollectionOnboarding } from "../test/QuestionCollectionOnboarding";
import { saveQuestionBankExport } from "../test/questionCollectionExport";
import { saveQuestionCollectionTemplate } from "../test/questionCollectionTemplate";
import "./question-bank.css";
import {
  CollectionQuestion,
  QuestionCollection,
  ValidationIssue,
} from "../test/questionCollectionTypes";
import { getCategoryOptions, getSubcategoryOptions } from "../test/testUtils";

const PAGE_SIZE = 100;

export function QuestionBankSection({
  t,
  collection,
  validationErrors,
  onImportFile,
  onClearValidationErrors,
}: {
  t: Translator;
  collection: QuestionCollection | null;
  validationErrors: ValidationIssue[];
  onImportFile: (file: File, merge?: boolean) => Promise<boolean>;
  onClearValidationErrors: () => void;
}) {
  const importMoreInputId = useId();
  const importMoreInputRef = useRef<HTMLInputElement | null>(null);
  const [importMoreOpen, setImportMoreOpen] = useState(false);
  const [toast, setToast] = useState<null | { message: string; variant: "success" | "error" }>(
    null,
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  const handleInitialImport = async (file: File) => {
    await onImportFile(file, false);
  };

  const handleExportQuestionBank = async () => {
    if (!collection) return;
    const result = await saveQuestionBankExport(collection);
    if (result.status === "saved") {
      setToast({ message: t("questionBank.exportSavedSuccess"), variant: "success" });
      return;
    }
    if (result.status === "error") {
      setToast({ message: t("questionBank.exportSavedError"), variant: "error" });
    }
  };

  const handleImportMore = async (file: File) => {
    const imported = await onImportFile(file, true);
    if (imported) setImportMoreOpen(false);
  };

  const closeImportMore = () => {
    setImportMoreOpen(false);
    onClearValidationErrors();
  };

  if (!collection) {
    return (
      <>
        <QuestionCollectionOnboarding
          t={t}
          errors={validationErrors}
          onDownloadTemplate={handleDownloadTemplate}
          onImportFile={(file) => void handleInitialImport(file)}
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

  return (
    <div className="question-bank-view">
      <Card
        title={t("questionBank.summaryTitle")}
        subtitle={t("questionBank.summarySubtitle")}
        className="question-bank-summary-card"
      >
        <div className="bank-summary">
          <MetricLine
            label={t("test.questions")}
            value={String(collection.summary.totalQuestions)}
          />
          <MetricLine
            label={t("test.topicCategories")}
            value={String(collection.summary.totalCategories)}
          />
          <MetricLine
            label={t("test.collectionSubcategories")}
            value={String(collection.summary.totalSubcategories)}
          />
          <MetricLine
            label={t("test.lastUpdated")}
            value={new Date(collection.importedAt).toLocaleString()}
          />
        </div>
        <div className="question-bank-summary-actions">
          <Button variant="secondary" onClick={() => setImportMoreOpen(true)}>
            {t("test.importMoreQuestions")}
          </Button>
          <Button onClick={() => void handleExportQuestionBank()}>
            {t("questionBank.exportQuestionBank")}
          </Button>
        </div>
      </Card>

      <QuestionTable t={t} questions={collection.questions} />

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
              <Button variant="secondary" onClick={closeImportMore}>
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
                if (file) void handleImportMore(file);
                event.currentTarget.value = "";
              }}
            />

            {validationErrors.length > 0 ? <ImportErrors t={t} errors={validationErrors} /> : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
          closeLabel={t("test.toastClose")}
        />
      ) : null}
    </div>
  );
}

function QuestionTable({ t, questions }: { t: Translator; questions: CollectionQuestion[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [page, setPage] = useState(1);

  const categoryOptions = useMemo(() => getCategoryOptions(questions), [questions]);
  const subcategoryOptions = useMemo(() => {
    const categories = category ? [category] : categoryOptions;
    return getSubcategoryOptions(questions, categories);
  }, [category, categoryOptions, questions]);

  useEffect(() => {
    setPage(1);
  }, [query, category, subcategory, questionType]);

  useEffect(() => {
    if (subcategory && !subcategoryOptions.includes(subcategory)) {
      setSubcategory("");
    }
  }, [subcategory, subcategoryOptions]);

  const filteredQuestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return questions.filter((question) => {
      if (category && question.questionCategory !== category) return false;
      if (subcategory && question.questionSubcategory !== subcategory) return false;
      if (questionType && question.questionType !== questionType) return false;
      if (!normalizedQuery) return true;
      return (
        question.id.toLowerCase().includes(normalizedQuery) ||
        question.question.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [category, query, questionType, questions, subcategory]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleQuestions = filteredQuestions.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = filteredQuestions.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filteredQuestions.length);

  return (
    <Card
      title={t("questionBank.tableTitle")}
      subtitle={t("questionBank.tableSubtitle", { count: questions.length })}
      className="question-table-card"
    >
      <div className="question-table-toolbar">
        <label className="field">
          <span>{t("questionBank.searchLabel")}</span>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("questionBank.searchPlaceholder")}
          />
        </label>

        <label className="field">
          <span>{t("questionBank.categoryFilter")}</span>
          <select
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("questionBank.allCategories")}</option>
            {categoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("questionBank.subcategoryFilter")}</span>
          <select
            className="input"
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
          >
            <option value="">{t("questionBank.allSubcategories")}</option>
            {subcategoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t("questionBank.typeFilter")}</span>
          <select
            className="input"
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value)}
          >
            <option value="">{t("questionBank.allTypes")}</option>
            <option value="single_choice">{t("questionBank.singleChoice")}</option>
            <option value="multiple_choice">{t("questionBank.multipleChoice")}</option>
          </select>
        </label>
      </div>

      <div className="question-table-meta">
        {t("questionBank.tableRange", {
          start: rangeStart,
          end: rangeEnd,
          total: filteredQuestions.length,
        })}
      </div>

      <div className="question-table-scroll">
        <table className="question-table">
          <thead>
            <tr>
              <th scope="col">{t("questionBank.columnId")}</th>
              <th scope="col">{t("questionBank.columnQuestion")}</th>
              <th scope="col">{t("questionBank.columnType")}</th>
              <th scope="col">{t("questionBank.columnCategory")}</th>
              <th scope="col">{t("questionBank.columnSubcategory")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleQuestions.map((question) => (
              <tr key={question.id}>
                <td>{question.id}</td>
                <td className="question-table-question" title={question.question}>
                  {question.question}
                </td>
                <td>
                  {question.questionType === "single_choice"
                    ? t("questionBank.singleChoice")
                    : t("questionBank.multipleChoice")}
                </td>
                <td>{question.questionCategory}</td>
                <td>{question.questionSubcategory || t("questionBank.noSubcategory")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleQuestions.length === 0 ? (
        <p className="placeholder-note question-table-empty">{t("questionBank.noMatches")}</p>
      ) : null}

      <div className="question-table-pagination" aria-label={t("questionBank.paginationLabel")}>
        <Button
          variant="secondary"
          disabled={safePage <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          {t("test.previous")}
        </Button>
        <span>{t("questionBank.pageStatus", { page: safePage, total: totalPages })}</span>
        <Button
          variant="secondary"
          disabled={safePage >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
        >
          {t("test.next")}
        </Button>
      </div>
    </Card>
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

function ImportErrors({ t, errors }: { t: Translator; errors: ValidationIssue[] }) {
  return (
    <div className="collection-errors import-more-errors" role="alert" aria-live="polite">
      <p className="collection-errors-title">{t("test.importErrorsTitle")}</p>
      <ul className="collection-errors-list">
        {errors.slice(0, 6).map((error) => (
          <li key={`${error.path}-${error.message}`}>
            <strong>{error.path}</strong>: {error.message}
          </li>
        ))}
      </ul>
      {errors.length > 6 ? (
        <p className="collection-errors-more">
          {t("test.importErrorsMore", { shown: 6, total: errors.length })}
        </p>
      ) : null}
    </div>
  );
}
