import { Translator } from "../../../app/types";
import { Button } from "../../../shared/components/Button";
import { ActiveTestRecovery } from "../../../services/persistence";

export function RecoveryModal({
  t,
  pendingActiveRecovery,
  activeRecoveryLoadError,
  onContinueRecoveredTest,
  onDiscardActiveRecovery,
  formatDuration,
}: {
  t: Translator;
  pendingActiveRecovery: ActiveTestRecovery | null;
  activeRecoveryLoadError: boolean;
  onContinueRecoveredTest: () => void;
  onDiscardActiveRecovery: () => void;
  formatDuration: (seconds: number) => string;
}) {
  if (!pendingActiveRecovery && !activeRecoveryLoadError) return null;

  return (
    <div className="recovery-modal-backdrop" role="presentation">
      <div
        className="recovery-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-modal-title"
      >
        <h3 id="recovery-modal-title" className="recovery-modal-title">
          {t("test.recoveryTitle")}
        </h3>
        {activeRecoveryLoadError ? (
          <p className="recovery-modal-body">{t("test.recoveryCorruptBody")}</p>
        ) : pendingActiveRecovery ? (
          <>
            <p className="recovery-modal-body">{t("test.recoveryBody")}</p>
            <div className="recovery-modal-info">
              <span>
                {t("test.recoveryTestInfo", {
                  title: pendingActiveRecovery.testDefinition.title,
                })}
              </span>
              <span>
                {t("test.recoveryQuestionCount", {
                  count: pendingActiveRecovery.activeAttempt.originalQuestionCount,
                })}
              </span>
              <span>
                {t("test.recoveryElapsedTime", {
                  duration: formatDuration(
                    pendingActiveRecovery.activeAttempt.savedElapsedSeconds ?? 0,
                  ),
                })}
              </span>
            </div>
          </>
        ) : null}
        <div className="recovery-modal-actions">
          {pendingActiveRecovery ? (
            <Button onClick={onContinueRecoveredTest}>{t("test.continueTest")}</Button>
          ) : null}
          <button type="button" className="btn btn-danger" onClick={onDiscardActiveRecovery}>
            {t("test.exitTest")}
          </button>
        </div>
      </div>
    </div>
  );
}
