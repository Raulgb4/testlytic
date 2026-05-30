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
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.8l1.55.9 1.82-.5.92 1.64 1.82.74-.16 1.92 1.25 1.46-1.25 1.46.16 1.92-1.82.74-.92 1.64-1.82-.5-1.55.9-1.55-.9-1.82.5-.92-1.64-1.82-.74.16-1.92-1.25-1.46 1.25-1.46-.16-1.92 1.82-.74.92-1.64 1.82.5L12 3.8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.9" stroke="currentColor" strokeWidth="1.6" />
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
