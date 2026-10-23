// Notification delivery (v0.2) — OS toast delivery, kept SEPARATE from the
// reminder calculation in scheduling.ts. This is the only place that talks to
// the platform notification API, so a future mobile/other delivery backend can
// replace just this file without touching the reminder rules.

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { Reminder } from "./scheduling";

// Cache the resolved permission for the session to avoid repeat prompts.
let permissionState: "granted" | "denied" | "unknown" = "unknown";

/**
 * Lazily ensure notification permission. Requests it once; caches the result.
 * Never throws — on any failure it reports "denied" so callers skip delivery
 * gracefully (in-app reminders still work regardless).
 */
async function ensurePermission(): Promise<boolean> {
  if (permissionState === "granted") return true;
  if (permissionState === "denied") return false;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    permissionState = granted ? "granted" : "denied";
    return granted;
  } catch (err) {
    console.error("[notifications] permission check failed:", err);
    permissionState = "denied";
    return false;
  }
}

/**
 * Deliver OS notifications for the given reminders. Permission is requested
 * lazily on the first call that has something to deliver. Each failure is
 * swallowed so a delivery problem never breaks the reminder flow.
 *
 * De-duplication is the CALLER's responsibility (it passes only
 * not-yet-notified reminders) — this keeps delivery stateless and reusable.
 */
export async function notifyReminders(reminders: Reminder[]): Promise<void> {
  if (reminders.length === 0) return;

  const granted = await ensurePermission();
  if (!granted) return;

  for (const r of reminders) {
    try {
      sendNotification({
        title: r.kind === "overdue" ? "Task overdue" : "Task due today",
        body: r.message,
      });
    } catch (err) {
      console.error("[notifications] sendNotification failed:", err);
    }
  }
}
