type NavItemProps = {
  label: string;
  icon: "test" | "analytics" | "settings";
  active: boolean;
  onClick: () => void;
};

function NavIcon({ icon }: { icon: "test" | "analytics" | "settings" }) {
  if (icon === "test") {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 8h8M8 12h8M8 16h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (icon === "analytics") {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="5.5"
          y="10"
          width="3"
          height="8.5"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <rect
          x="10.5"
          y="6.5"
          width="3"
          height="12"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <rect
          x="15.5"
          y="8.5"
          width="3"
          height="10"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function NavItem({ label, icon, active, onClick }: NavItemProps) {
  return (
    <button type="button" className={active ? "nav-item active" : "nav-item"} onClick={onClick}>
      <NavIcon icon={icon} />
      <span className="nav-title">{label}</span>
    </button>
  );
}
