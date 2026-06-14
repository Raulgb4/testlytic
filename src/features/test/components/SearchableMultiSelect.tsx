import { RefObject, useMemo, useState } from "react";

export function SearchableMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  selectedCountLabel,
  clearLabel,
  selectAllLabel,
  onSelectAll,
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
  selectAllLabel?: string;
  onSelectAll?: () => void;
  closeLabel: string;
  disabled?: boolean;
  disabledText?: string;
  error?: string;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedValues = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(
    () => options.filter((item) => item.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

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
                  checked={selectedValues.has(option)}
                  onChange={() => toggleSelection(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <div className="multi-select-actions">
            <div className="multi-select-bulk-actions">
              <button type="button" className="btn btn-secondary" onClick={() => onChange([])}>
                {clearLabel}
              </button>
              {selectAllLabel && onSelectAll ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onSelectAll}
                  disabled={options.length === 0}
                >
                  {selectAllLabel}
                </button>
              ) : null}
            </div>
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
