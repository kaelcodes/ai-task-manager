import { useState, useEffect, useCallback } from "react";
import type { NavPage, Task, Preferences } from "./types";
import { fetchTasks } from "./services";
import {
  loadPreferences,
  savePreferences,
  DEFAULT_PREFERENCES,
  ACCENT_HEX,
} from "./services/preferences";
import Sidebar from "./components/Sidebar";
import ReminderBanner from "./components/ReminderBanner";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import AIAssistant from "./pages/AIAssistant";
import Settings from "./pages/Settings";
import styles from "./App.module.css";

function App() {
  const [activePage, setActivePage] = useState<NavPage>("dashboard");

  // ── Mobile navigation drawer ───────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigate from either the desktop sidebar or the mobile drawer.
  // Selecting an item always closes the drawer (no-op on desktop).
  const navigate = useCallback((page: NavPage) => {
    setActivePage(page);
    setDrawerOpen(false);
  }, []);

  // Close on Escape, and lock background scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  // ── Shared task state ────────────────────────────────────────────────────
  // Owned here so both Dashboard and Tasks read from the same array.
  // Tasks.tsx calls refreshTasks() after every mutation.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const rows = await fetchTasks();
      setTasks(rows);
    } catch (err) {
      console.error("[App] fetchTasks failed:", err);
      setTasksError("Failed to load tasks.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // Load once on mount (after initDatabase() in main.tsx has resolved)
  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  // ── Preferences (Module 7) ─────────────────────────────────────────────────
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Load preferences on mount.
  useEffect(() => {
    void loadPreferences().then(setPreferences);
  }, []);

  // Apply the accent color as a CSS custom property whenever it changes.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--accent",
      ACCENT_HEX[preferences.accentColor]
    );
  }, [preferences.accentColor]);

  // Persist and apply updated preferences (validated inside savePreferences).
  const updatePreferences = useCallback(async (next: Preferences) => {
    const saved = await savePreferences(next);
    setPreferences(saved);
  }, []);

  // ── Page rendering ───────────────────────────────────────────────────────

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return (
          <Dashboard
            tasks={tasks}
            loading={tasksLoading}
            error={tasksError}
            onNavigateToTasks={() => setActivePage("tasks")}
          />
        );
      case "tasks":
        return (
          <Tasks
            tasks={tasks}
            loading={tasksLoading}
            onTasksChange={refreshTasks}
            defaultPriority={preferences.defaultPriority}
            defaultStatus={preferences.defaultStatus}
          />
        );
      case "schedule":
        return <Schedule tasks={tasks} loading={tasksLoading} />;
      case "analytics":
        return <Analytics tasks={tasks} loading={tasksLoading} />;
      case "assistant":
        return (
          <AIAssistant
            tasks={tasks}
            onTasksChange={refreshTasks}
            onNavigateToSettings={() => setActivePage("settings")}
          />
        );
      case "settings":
        return (
          <Settings
            preferences={preferences}
            onUpdatePreferences={updatePreferences}
            tasks={tasks}
            onTasksChange={refreshTasks}
          />
        );
    }
  }

  return (
    <div className={styles.shell}>
      {/* Desktop persistent sidebar (hidden on mobile via CSS). */}
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        className={styles.desktopSidebar}
      />

      {/* Mobile slide-in drawer + backdrop (hidden on desktop via CSS). */}
      <div
        className={`${styles.backdrop} ${drawerOpen ? styles.backdropOpen : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!drawerOpen}
      >
        <button
          className={styles.drawerClose}
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation menu"
        >
          ✕
        </button>
        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          id="mobile-nav-drawer"
        />
      </div>

      <main className={styles.main}>
        {/* Mobile header with hamburger (hidden on desktop via CSS). */}
        <header className={styles.mobileHeader}>
          <button
            className={styles.hamburger}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
          >
            ☰
          </button>
          <span className={styles.mobileTitle}>AI Task Manager</span>
        </header>

        {/* Always mounted so the reminder hook's dismissed-set survives task
            refreshes. The banner self-hides when there are no active reminders. */}
        <ReminderBanner
          tasks={tasks}
          onOpenTasks={() => navigate("tasks")}
        />
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
