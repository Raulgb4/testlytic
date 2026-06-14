import { Translator } from "../../../app/types";
import { Button } from "../../../shared/components/Button";
import { MetricLine } from "../components/MetricLine";

export function FinishConfirmModal({
  t,
  finishSummary,
  allowUnanswered,
  onCancel,
  onConfirm,
}: {
  t: Translator;
  finishSummary: {
    answered: number;
    unanswered: number;
    correct: number;
    incorrect: number;
  };
  allowUnanswered: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="settings-modal-backdrop" role="presentation">
      <div className="settings-modal finish-confirm-modal" role="dialog" aria-modal="true">
        <h3>{t("test.finishConfirmTitle")}</h3>
        <p>{t("test.finishConfirmBody")}</p>
        <div className="finish-confirm-summary">
          <MetricLine label={t("test.statusAnswered")} value={String(finishSummary.answered)} />
          <MetricLine label={t("test.kpiUnanswered")} value={String(finishSummary.unanswered)} />
          <MetricLine label={t("test.statusCorrect")} value={String(finishSummary.correct)} />
          <MetricLine label={t("test.statusWrong")} value={String(finishSummary.incorrect)} />
        </div>
        {!allowUnanswered && finishSummary.unanswered > 0 ? (
          <p className="field-error finish-confirm-blocked">
            {t("test.finishConfirmBlocked", { count: finishSummary.unanswered })}
          </p>
        ) : null}
        <div className="settings-modal-actions finish-confirm-actions">
          <Button variant="secondary" onClick={onCancel}>
            {t("test.cancel")}
          </Button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={!allowUnanswered && finishSummary.unanswered > 0}
          >
            {t("test.finishConfirmAction")}
          </button>
        </div>
      </div>
    </div>
  );
}
