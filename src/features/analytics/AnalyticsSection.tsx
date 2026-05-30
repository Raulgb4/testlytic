import { useState } from "react";
import { Translator } from "../../app/types";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { StatusPill } from "../../shared/components/StatusPill";
import { Tabs } from "../../shared/components/Tabs";
import { toPercent } from "../../shared/utils/format";
import { AnalyticsTab, MockAnswerHistoryRow, MockCompletedAttempt } from "./analyticsTypes";
import { calculateAnalyticsSummary, filterHistoryRows } from "./analyticsUtils";

export function AnalyticsSection({
  t,
  completedAttempts,
  answerHistory,
}: {
  t: Translator;
  completedAttempts: MockCompletedAttempt[];
  answerHistory: MockAnswerHistoryRow[];
}) {
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState(t("analytics.allTopics"));

  const summary = calculateAnalyticsSummary(completedAttempts);
  const historyTopics = [
    t("analytics.allTopics"),
    ...Array.from(new Set(answerHistory.map((row) => row.topic))).sort(),
  ];
  const filteredRows = filterHistoryRows(answerHistory, searchQuery, topicFilter);

  if (analyticsTab === "history") {
    return (
      <div className="view-grid">
        <Card title={t("analytics.title")} subtitle={t("analytics.historySubtitle")}>
          <Tabs
            items={[
              { id: "dashboard", label: t("analytics.tabDashboard") },
              { id: "history", label: t("analytics.tabHistory") },
            ]}
            active={analyticsTab}
            onChange={setAnalyticsTab}
          />

          <div className="history-toolbar">
            <input
              className="input"
              placeholder={t("analytics.searchPlaceholder")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select
              className="input"
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
            >
              {historyTopics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>{t("analytics.colDate")}</th>
                  <th>{t("analytics.colTest")}</th>
                  <th>{t("analytics.colTopic")}</th>
                  <th>{t("analytics.colQuestion")}</th>
                  <th>{t("analytics.colSelected")}</th>
                  <th>{t("analytics.colCorrect")}</th>
                  <th>{t("analytics.colResult")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.testTitle}</td>
                    <td>{row.topic}</td>
                    <td>{row.question}</td>
                    <td>{row.selectedAnswer}</td>
                    <td>{row.correctAnswer}</td>
                    <td>
                      <StatusPill
                        status={row.result}
                        label={
                          row.result === "correct"
                            ? t("analytics.statusCorrect")
                            : row.result === "incorrect"
                              ? t("analytics.statusIncorrect")
                              : t("analytics.statusUnanswered")
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="placeholder-note">
            {t("analytics.showingRows", {
              count: filteredRows.length,
              total: answerHistory.length,
            })}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="view-grid">
      <Card title={t("analytics.title")} subtitle={t("analytics.subtitle")}>
        <Tabs
          items={[
            { id: "dashboard", label: t("analytics.tabDashboard") },
            { id: "history", label: t("analytics.tabHistory") },
          ]}
          active={analyticsTab}
          onChange={setAnalyticsTab}
        />

        <div className="kpi-grid">
          <MetricCard
            item={{
              label: t("analytics.avgScore"),
              value: toPercent(summary.averageScore),
              change: t("analytics.mockSample"),
            }}
          />
          <MetricCard
            item={{
              label: t("analytics.completedTests"),
              value: String(summary.completedTests),
              change: t("analytics.mockAttempts"),
            }}
          />
          <MetricCard
            item={{
              label: t("analytics.accuracy"),
              value: toPercent(summary.accuracy),
              change: t("analytics.acrossMock"),
            }}
          />
          <MetricCard
            item={{
              label: t("analytics.weakestTopic"),
              value: summary.weakestTopic || t("analytics.noDataTopic"),
              change: t("analytics.derivedMock"),
            }}
          />
        </div>
      </Card>

      <Card title={t("analytics.trendTitle")} subtitle={t("analytics.trendSubtitle")}>
        <div className="chart-placeholder">{t("analytics.chartPlaceholder")}</div>
      </Card>

      <Card title={t("analytics.topicTitle")} subtitle={t("analytics.topicSubtitle")}>
        <div className="chart-placeholder">{t("analytics.chartPlaceholder")}</div>
      </Card>

      <Card title={t("analytics.missedTitle")} subtitle={t("analytics.missedSubtitle")}>
        <div className="chart-placeholder">{t("analytics.chartPlaceholder")}</div>
      </Card>
    </div>
  );
}
