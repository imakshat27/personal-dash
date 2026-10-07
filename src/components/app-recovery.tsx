import { Component, useEffect, useState, type ReactNode } from "react";
import { registerSW } from "virtual:pwa-register";

const updateEvent = "orbit:app-update";
let updateAvailable = false;
let registration: ServiceWorkerRegistration | undefined;
function showUpdate() {
  updateAvailable = true;
  window.dispatchEvent(new Event(updateEvent));
}
const updateSW = registerSW({
  onNeedRefresh: showUpdate,
  onRegisteredSW(_url, value) {
    registration = value;
  },
});
// New workers take control without reloading a page containing unsaved work.
// Ask before refreshing the document; the next navigation fetches fresh HTML.
if ("serviceWorker" in navigator) {
  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled) showUpdate();
    controlled = true;
  });
}
function applyUpdate() {
  if (registration?.waiting) void updateSW(true);
  else window.location.reload();
}

// Recover static application code without removing notes, demo files or sessions.
export async function refreshApplication() {
  const registrations = await navigator.serviceWorker?.getRegistrations();
  await Promise.all((registrations || []).map((entry) => entry.unregister()));
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("workbox-precache"))
        .map((key) => caches.delete(key)),
    );
  }
  window.location.reload();
}

export function AppUpdate() {
  const [available, setAvailable] = useState(updateAvailable);
  useEffect(() => {
    const show = () => setAvailable(true);
    window.addEventListener(updateEvent, show);
    return () => window.removeEventListener(updateEvent, show);
  }, []);
  if (!available) return null;
  return (
    <div className="app-update" role="status">
      <span>A fresh Orbit is ready. Save your work before updating.</span>
      <button className="primary" onClick={applyUpdate}>
        Update Orbit
      </button>
    </div>
  );
}

export class AppRecovery extends Component<
  { children: ReactNode },
  { failed: boolean; refreshing: boolean }
> {
  state = { failed: false, refreshing: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-recovery" role="alert">
        <span className="eyebrow">YOUR SPACE IS STILL HERE</span>
        <h1>Let’s refresh your orbit.</h1>
        <p>
          The app couldn’t finish loading. Refresh its saved version to try
          again. Your notes, files and sign-in stay in place.
        </p>
        <button
          className="primary"
          disabled={this.state.refreshing}
          onClick={() => {
            this.setState({ refreshing: true });
            void refreshApplication().catch(() => window.location.reload());
          }}
        >
          {this.state.refreshing ? "Refreshing…" : "Refresh Orbit"}
        </button>
        <a href="/integrations">Open integrations</a>
      </main>
    );
  }
}
