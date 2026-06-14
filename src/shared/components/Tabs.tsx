export type TabItem<T extends string> = {
  id: T;
  label: string;
};

export function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs-row">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? "tab-btn active" : "tab-btn"}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
