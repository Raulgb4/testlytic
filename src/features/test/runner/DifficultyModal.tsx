import { Translator } from "../../../app/types";
import { Button } from "../../../shared/components/Button";
import { DifficultyLevel } from "../questionCollectionTypes";

type RatedDifficulty = Exclude<DifficultyLevel, "unrated">;

export function DifficultyModal({
  t,
  questionText,
  difficultyOptions,
  difficultySelection,
  onDifficultySelectionChange,
  onClose,
  onSave,
}: {
  t: Translator;
  questionText: string;
  difficultyOptions: Array<{ value: RatedDifficulty; labelKey: string }>;
  difficultySelection: RatedDifficulty;
  onDifficultySelectionChange: (difficulty: RatedDifficulty) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="settings-modal-backdrop" role="presentation">
      <div
        className="settings-modal difficulty-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="difficulty-modal-title"
      >
        <h3 id="difficulty-modal-title">{t("test.difficultyModalTitle")}</h3>
        <p>{t("test.difficultyModalBody")}</p>
        <div className="difficulty-modal-question">{questionText}</div>

        <fieldset className={`difficulty-selector difficulty-${difficultySelection}`}>
          <legend>{t("test.rateDifficulty")}</legend>
          <span className="difficulty-selector-thumb" aria-hidden="true" />
          {difficultyOptions.map((option) => (
            <label
              key={option.value}
              className={
                difficultySelection === option.value
                  ? "difficulty-selector-option selected"
                  : "difficulty-selector-option"
              }
            >
              <input
                type="radio"
                name="question-difficulty"
                value={option.value}
                checked={difficultySelection === option.value}
                onChange={() => onDifficultySelectionChange(option.value)}
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </fieldset>

        <div className="settings-modal-actions difficulty-modal-actions">
          <Button variant="secondary" onClick={onClose}>
            {t("test.cancel")}
          </Button>
          <Button onClick={onSave}>{t("test.saveDifficulty")}</Button>
        </div>
      </div>
    </div>
  );
}
