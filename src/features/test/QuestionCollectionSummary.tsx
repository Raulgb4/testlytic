import { Translator } from "../../app/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { QuestionCollection } from "./questionCollectionTypes";

export function QuestionCollectionSummary({
  t,
  collection,
  onConfigure,
}: {
  t: Translator;
  collection: QuestionCollection;
  onConfigure: () => void;
}) {
  return (
    <div className="view-grid">
      <Card title={t("test.collectionSummaryTitle")} subtitle={t("test.collectionSummarySubtitle")}>
        <div className="bank-summary">
          <div className="metric-inline">
            <span className="metric-inline-label">{t("test.questions")}</span>
            <span className="metric-inline-value">{collection.summary.totalQuestions}</span>
          </div>
          <div className="metric-inline">
            <span className="metric-inline-label">{t("test.topicCategories")}</span>
            <span className="metric-inline-value">{collection.summary.totalCategories}</span>
          </div>
          <div className="metric-inline">
            <span className="metric-inline-label">{t("test.collectionSubcategories")}</span>
            <span className="metric-inline-value">{collection.summary.totalSubcategories}</span>
          </div>
          <div className="metric-inline">
            <span className="metric-inline-label">{t("test.collectionSingleChoice")}</span>
            <span className="metric-inline-value">{collection.summary.totalSingleChoice}</span>
          </div>
          <div className="metric-inline">
            <span className="metric-inline-label">{t("test.collectionMultipleChoice")}</span>
            <span className="metric-inline-value">{collection.summary.totalMultipleChoice}</span>
          </div>
          <div className="metric-inline">
            <span className="metric-inline-label">{t("test.collectionSources")}</span>
            <span className="metric-inline-value">{collection.summary.totalSources}</span>
          </div>
        </div>

        <div className="card-actions">
          <Button onClick={onConfigure}>{t("test.configure")}</Button>
        </div>
      </Card>
    </div>
  );
}
