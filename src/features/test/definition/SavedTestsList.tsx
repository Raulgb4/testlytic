import { Translator } from "../../../app/types";
import { Button } from "../../../shared/components/Button";
import { TestDefinition } from "../testTypes";

export function SavedTestsList({
  t,
  definitions,
  exportingPdfTestId,
  getMatchingCount,
  getTimeLimitMinutes,
  onRunDefinition,
  onExportPdfDefinition,
  onOpenEdit,
  onDelete,
}: {
  t: Translator;
  definitions: TestDefinition[];
  exportingPdfTestId: string | null;
  getMatchingCount: (definition: TestDefinition) => number;
  getTimeLimitMinutes: (definition: TestDefinition) => number;
  onRunDefinition: (definition: TestDefinition) => void;
  onExportPdfDefinition: (definition: TestDefinition) => void;
  onOpenEdit: (definition: TestDefinition) => void;
  onDelete: (definition: TestDefinition) => void;
}) {
  return (
    <div className="saved-tests-section">
      {definitions.length === 0 ? (
        <p className="placeholder-note">{t("test.noSavedTests")}</p>
      ) : null}
      <div className="saved-tests-list">
        {definitions.map((definition) => {
          const matchingCount = getMatchingCount(definition);
          return (
            <article key={definition.id} className="saved-test-item">
              <div>
                <p className="saved-test-title">{definition.title}</p>
                <p className="saved-test-meta">
                  {t("test.savedTestMeta", {
                    questions: definition.questionLimit,
                    categories: definition.includedCategories.length,
                    time:
                      getTimeLimitMinutes(definition) > 0
                        ? t("test.savedTestTimeLimit", {
                            minutes: getTimeLimitMinutes(definition),
                          })
                        : t("test.savedTestNoTimeLimit"),
                    negative: definition.negativeMarkingEnabled
                      ? t("test.savedTestNegativeOn")
                      : t("test.savedTestNegativeOff"),
                    matching: matchingCount,
                  })}
                </p>
              </div>
              <div className="saved-test-actions">
                <Button onClick={() => onRunDefinition(definition)}>{t("test.run")}</Button>
                <Button
                  variant="secondary"
                  disabled={Boolean(exportingPdfTestId)}
                  onClick={() => onExportPdfDefinition(definition)}
                >
                  {exportingPdfTestId === definition.id
                    ? t("test.exportingPdf")
                    : t("test.exportPdf")}
                </Button>
                <Button variant="secondary" onClick={() => onOpenEdit(definition)}>
                  {t("test.edit")}
                </Button>
                <Button variant="secondary" onClick={() => onDelete(definition)}>
                  {t("test.delete")}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
