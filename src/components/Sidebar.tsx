import type { NavPage } from "../types";
import styles from "./Sidebar.module.css";

interface NavItem {
  id: NavPage;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "schedule", label: "Schedule", icon: "◷" },
  { id: "analytics", label: "Analytics", icon: "▦" },
  { id: "assistant", label: "AI Assistant", icon: "✦" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  /** Extra class (e.g. drawer-specific layout). Optional; desktop unaffected. */
  className?: string;
  /** Optional id for aria wiring when used as a drawer. */
  id?: string;
}

export default function Sidebar({
  activePage,
  onNavigate,
  className,
  id,
}: SidebarProps) {
  return (
    <aside
      className={`${styles.sidebar} ${className ?? ""}`}
      id={id}
      aria-label="Main navigation"
    >
      <div className={styles.logo}>
        <span className={styles.logoIcon} aria-hidden="true">✦</span>
        <span className={styles.logoText}>AI Task Manager</span>
      </div>

      <nav>
        <ul className={styles.navList} role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                className={`${styles.navItem} ${activePage === item.id ? styles.navItemActive : ""}`}
                onClick={() => onNavigate(item.id)}
                aria-current={activePage === item.id ? "page" : undefined}
              >
                <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
