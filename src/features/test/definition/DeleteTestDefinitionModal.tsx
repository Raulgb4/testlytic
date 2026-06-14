import { Translator } from "../../../app/types";
import { Button } from "../../../shared/components/Button";
import { TestDefinition } from "../testTypes";

export function DeleteTestDefinitionModal({
  t,
  deleteTarget,
  onConfirm,
  onCancel,
}: {
  t: Translator;
  deleteTarget: TestDefinition | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!deleteTarget) return null;

  return (
    <div className="settings-modal-backdrop" role="presentation">
      <div className="settings-modal" role="dialog" aria-modal="true">
        <h3>{t("test.deleteTestConfirmTitle")}</h3>
        <p>{t("test.deleteTestConfirmBody", { title: deleteTarget.title })}</p>
        <div className="delete-test-confirm-actions">
          <Button onClick={onConfirm}>{t("settings.confirm")}</Button>
          <Button variant="secondary" onClick={onCancel}>
            {t("test.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
