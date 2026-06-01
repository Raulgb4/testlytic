import { useMemo, useState } from "react";
import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { toFixed } from "../../shared/utils/format";
import { DEFAULT_TEST_CONFIG } from "./mockQuestions";
import { QuestionCollectionOnboarding } from "./QuestionCollectionOnboarding";
import { QuestionCollectionSummary } from "./QuestionCollectionSummary";
import { downloadQuestionCollectionTemplate } from "./questionCollectionTemplate";
import {
  mapCollectionToSessionQuestions,
  QuestionCollection,
  ValidationIssue,
} from "./questionCollectionTypes";
import { validateQuestionCollectionJson } from "./questionCollectionValidation";
import { MockQuestion, TestConfig, TestFlowStatus, TestResult } from "./testTypes";
import { buildTopicCategories, calculateResults, getFilteredQuestions } from "./testUtils";

export function TestSection({ t }: { t: Translator }) {
  const allTopicsLabel = t("test.allTopics");
  const [status, setStatus] = useState<TestFlowStatus>("landing");
  const [config, setConfig] = useState<TestConfig>(DEFAULT_TEST_CONFIG);
  const [collection, setCollection] = useState<QuestionCollection | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [finishWarning, setFinishWarning] = useState("");

  const availableQuestions = useMemo(
    () => (collection ? mapCollectionToSessionQuestions(collection) : []),
    [collection],
  );

  const beginSession = (nextConfig: TestConfig) => {
    const sessionQuestions = getFilteredQuestions(nextConfig, availableQuestions, allTopicsLabel);
    const initialAnswers: Record<string, string | null> = {};
    for (const question of sessionQuestions) {
      initialAnswers[question.id] = null;
    }
    setConfig(nextConfig);
    setQuestions(sessionQuestions);
    setAnswers(initialAnswers);
    setCurrentIndex(0);
    setResult(null);
    setFinishWarning("");
    setStatus("active");
  };

  const handleStartFromConfig = () => beginSession(config);

  const setAnswer = (questionId: string, optionId: string) => {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
    setFinishWarning("");
  };

  const skipCurrent = () => {
    const question = questions[currentIndex];
    if (question) setAnswers((current) => ({ ...current, [question.id]: null }));
    setFinishWarning("");
  };

  const finishSession = () => {
    const unanswered = questions.filter((question) => !answers[question.id]).length;
    if (!config.allowUnanswered && unanswered > 0) {
      setFinishWarning(t("test.finishWarning", { count: unanswered }));
      return;
    }
    setResult(calculateResults(questions, answers, config));
    setStatus("results");
  };

  const importCollectionFile = async (file: File) => {
    const raw = await file.text();
    const validation = validateQuestionCollectionJson(raw);
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      return;
    }

    setCollection(validation.collection);
    setValidationErrors([]);
    setStatus("landing");
    setConfig({
      ...DEFAULT_TEST_CONFIG,
      topicCategory: allTopicsLabel,
      questionCount: Math.min(DEFAULT_TEST_CONFIG.questionCount, validation.collection.summary.totalQuestions),
    });
  };

  if (!collection) {
    return (
      <QuestionCollectionOnboarding
        t={t}
        errors={validationErrors}
        onDownloadTemplate={downloadQuestionCollectionTemplate}
        onImportFile={importCollectionFile}
      />
    );
  }

  if (status === "configure") {
    const availableForCategory = getFilteredQuestions(
      {
        ...config,
        questionCount: availableQuestions.length,
      },
      availableQuestions,
      allTopicsLabel,
    ).length;

    const titleError = config.title.trim().length === 0;
    const countError = config.questionCount < 1 || config.questionCount > availableForCategory;
    const timeError = config.timeLimitMinutes < 0;
    const isValid = !titleError && !countError && !timeError;

    const topicOptions = buildTopicCategories(allTopicsLabel, availableQuestions);

    const update = <K extends keyof TestConfig>(key: K, value: TestConfig[K]) => {
      setConfig({ ...config, [key]: value });
    };

    return (
      <div className="view-grid">
        <Card title={t("test.configTitle")} subtitle={t("test.configSubtitle")}>
          <div className="form-grid">
            <label className="field">
              <span>{t("test.title")}</span>
              <input
                className="input"
                value={config.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder={t("test.titlePlaceholder")}
              />
              {titleError ? <small className="field-error">{t("test.titleRequired")}</small> : null}
            </label>

            <label className="field">
              <span>{t("test.topicCategory")}</span>
              <select
                className="input"
                value={config.topicCategory}
                onChange={(event) => update("topicCategory", event.target.value)}
              >
                {topicOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("test.questionCount")}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={Math.max(1, availableForCategory)}
                value={config.questionCount}
                onChange={(event) => update("questionCount", Number(event.target.value || 0))}
              />
              {countError ? (
                <small className="field-error">
                  {t("test.countRange", { max: availableForCategory })}
                </small>
              ) : null}
            </label>

            <label className="field">
              <span>{t("test.timeLimit")}</span>
              <input
                className="input"
                type="number"
                min={0}
                value={config.timeLimitMinutes}
                onChange={(event) => update("timeLimitMinutes", Number(event.target.value || 0))}
              />
              {timeError ? <small className="field-error">{t("test.timeNonNegative")}</small> : null}
            </label>

            <label className="field field-inline">
              <input
                type="checkbox"
                checked={config.negativeMarking}
                onChange={(event) => update("negativeMarking", event.target.checked)}
              />
              <span>{t("test.negativeMarking")}</span>
            </label>

            <label className="field">
              <span>{t("test.negativeValue")}</span>
              <input
                className="input"
                type="number"
                min={0}
                step={0.05}
                disabled={!config.negativeMarking}
                value={config.negativeMarkingValue}
                onChange={(event) => update("negativeMarkingValue", Number(event.target.value || 0))}
              />
            </label>

            <label className="field field-inline">
              <input
                type="checkbox"
                checked={config.allowUnanswered}
                onChange={(event) => update("allowUnanswered", event.target.checked)}
              />
              <span>{t("test.allowUnanswered")}</span>
            </label>
          </div>

          <div className="card-actions">
            <Button onClick={handleStartFromConfig} disabled={!isValid}>
              {t("test.start")}
            </Button>
            <Button variant="secondary" onClick={() => setStatus("landing")}>
              {t("test.cancel")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (status === "active") {
    if (questions.length === 0) {
      setStatus("landing");
    } else {
      const currentQuestion = questions[currentIndex];
      const answeredCount = questions.filter((question) => answers[question.id]).length;
      return (
        <div className="view-grid">
          <Card
            title={config.title}
            subtitle={t("test.activeSubtitle", {
              topicCategory: config.topicCategory,
              current: currentIndex + 1,
              total: questions.length,
            })}
          >
            <div className="test-headline">
              <span className="tag">
                {t("test.answered", { count: answeredCount, total: questions.length })}
              </span>
              <span className="tag">
                {t("test.timeStatic", { minutes: config.timeLimitMinutes })}
              </span>
            </div>
          </Card>

          <Card
            title={t("test.questionTitle", { number: currentIndex + 1 })}
            subtitle={`${currentQuestion.topic} / ${currentQuestion.category}`}
          >
            <p className="question-statement">{currentQuestion.statement}</p>
            <div className="options-list">
              {currentQuestion.options.map((option) => {
                const selected = answers[currentQuestion.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={selected ? "option-row selected" : "option-row"}
                    onClick={() => setAnswer(currentQuestion.id, option.id)}
                  >
                    <span className="option-key">{option.id.toUpperCase()}</span>
                    <span>{option.text}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title={t("test.progressTitle")} subtitle={t("test.progressSubtitle")}>
            <div className="chips-grid">
              {questions.map((question, index) => {
                const isCurrent = index === currentIndex;
                const isAnswered = Boolean(answers[question.id]);
                const className = isCurrent
                  ? "progress-chip current"
                  : isAnswered
                    ? "progress-chip answered"
                    : "progress-chip";
                return (
                  <button
                    key={question.id}
                    type="button"
                    className={className}
                    onClick={() => setCurrentIndex(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            {finishWarning ? <p className="field-error">{finishWarning}</p> : null}

            <div className="card-actions">
              <Button
                variant="secondary"
                onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                disabled={currentIndex === 0}
              >
                {t("test.previous")}
              </Button>
              <Button variant="secondary" onClick={skipCurrent}>
                {t("test.skip")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
                disabled={currentIndex === questions.length - 1}
              >
                {t("test.next")}
              </Button>
              <Button onClick={finishSession}>{t("test.finish")}</Button>
            </div>
          </Card>
        </div>
      );
    }
  }

  if (status === "results" && result) {
    return (
      <div className="view-grid">
        <Card title={t("test.resultsTitle")} subtitle={t("test.resultsSubtitle")}>
          <div className="kpi-grid">
            <MetricCard
              item={{
                label: t("test.score"),
                value: toFixed(result.score, 2),
                change: config.negativeMarking
                  ? t("test.negativeInfo", { value: config.negativeMarkingValue })
                  : t("test.noNegative"),
              }}
            />
            <MetricCard
              item={{
                label: t("test.correct"),
                value: String(result.correct),
                change: t("test.ofTotal", { total: result.total }),
              }}
            />
            <MetricCard
              item={{
                label: t("test.incorrect"),
                value: String(result.incorrect),
                change: t("test.mockSession"),
              }}
            />
            <MetricCard
              item={{
                label: t("test.unanswered"),
                value: String(result.unanswered),
                change: t("test.mockSession"),
              }}
            />
          </div>
        </Card>

        <Card title={t("test.reviewTitle")} subtitle={t("test.reviewSubtitle")}>
          <div className="review-list">
            {questions.map((question, index) => {
              const selected = answers[question.id];
              const selectedText = question.options.find((option) => option.id === selected)?.text;
              const correctText = question.options.find(
                (option) => option.id === question.correctOptionId,
              )?.text;
              return (
                <article key={question.id} className="review-item">
                  <p className="review-title">
                    Q{index + 1}. {question.statement}
                  </p>
                  <p className="review-line">
                    {t("test.selected")}:{" "}
                    {selected ? `${selected.toUpperCase()} · ${selectedText}` : t("test.unansweredText")}
                  </p>
                  <p className="review-line">
                    {t("test.correctAnswer")}: {question.correctOptionId.toUpperCase()} · {correctText}
                  </p>
                  <p className="review-note">
                    {t("test.explanation")}: {question.explanation}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="card-actions">
            <Button onClick={() => beginSession(config)}>{t("test.startAnother")}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStatus("landing");
                setResult(null);
              }}
            >
              {t("test.backHome")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <QuestionCollectionSummary t={t} collection={collection} onConfigure={() => setStatus("configure")} />;
}
