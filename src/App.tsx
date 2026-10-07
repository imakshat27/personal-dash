import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  SquaresFour,
  GlobeHemisphereWest,
  FolderSimple,
  CalendarBlank,
  FileText,
  Plugs,
  GearSix,
  MagnifyingGlass,
  Plus,
  Bell,
  CaretDown,
  ArrowUpRight,
  Moon,
  Sun,
  List,
  X,
  ArrowRight,
  CheckCircle,
} from "@phosphor-icons/react";
import { Dashboard } from "./pages/dashboard";
import { Storage } from "./pages/storage";
import { Notes } from "./pages/notes";
import { Calendar, Integrations, Settings, Sites } from "./pages/modules";
import { Capture } from "./components/capture";
import { Search } from "./components/search";
import { Modal } from "./components/ui";
import { isDemo } from "./lib/api";
import { Login } from "./pages/login";
import type { Note } from "../shared/models";
const navigation = [
  { to: "/", label: "Dashboard", icon: SquaresFour },
  { to: "/sites", label: "Sites & infra", icon: GlobeHemisphereWest },
  { to: "/storage", label: "My storage", icon: FolderSimple },
  { to: "/calendar", label: "Calendar", icon: CalendarBlank },
  { to: "/notes", label: "Notes", icon: FileText },
];
function OrbitLogo() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <ellipse
        cx="20"
        cy="20"
        rx="18"
        ry="9"
        transform="rotate(-35 20 20)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="20" cy="20" r="7" fill="currentColor" />
      <circle
        cx="32"
        cy="9"
        r="3.5"
        fill="var(--surface)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
export default function App() {
  const location = useLocation();
  return location.pathname === "/login" ? <Login /> : <Workspace />;
}
function Workspace() {
  const location = useLocation();
  const [search, setSearch] = useState(false);
  const [capture, setCapture] = useState(false);
  const [editing, setEditing] = useState<Note | undefined>();
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("orbit.theme") || "light",
  );
  const [offline, setOffline] = useState(!navigator.onLine);
  const isDark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const page =
    [
      ...navigation,
      { to: "/integrations", label: "Integrations" },
      { to: "/settings", label: "Settings" },
    ].find((n) => n.to === location.pathname)?.label || "Your space";
  function openCapture() {
    setEditing(undefined);
    setCapture(true);
  }
  function editNote(note: Note) {
    setEditing(note);
    setCapture(true);
  }
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("orbit.theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearch((v) => !v);
      } else if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault();
        setEditing(undefined);
        setCapture(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    function update() {
      setOffline(!navigator.onLine);
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    setMobile(false);
    document.title = `${page} · Orbit`;
    document.getElementById("main-content")?.focus();
  }, [location.pathname, page]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <NavLink to="/" className="brand">
          <OrbitLogo />
          <span>
            orbit<span className="brand-dot">.</span>
          </span>
        </NavLink>
        <button className="workspace-switch" onClick={() => setProfile(true)}>
          <span className="workspace-icon">a.</span>
          <span>
            <strong>Akshat’s space</strong>
            <small>A little world of your own</small>
          </span>
          <CaretDown size={14} />
        </button>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <NavLink to={n.to} end={n.to === "/"} key={n.to}>
              <n.icon
                size={21}
                weight={page === n.label ? "duotone" : "regular"}
              />
              <span>{n.label}</span>
              {n.to === "/" && <span className="nav-indicator" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-tools">
          <span className="nav-label">MAKE IT YOURS</span>
          <nav aria-label="Preferences">
            <NavLink to="/integrations">
              <Plugs size={21} />
              <span>Integrations</span>
              <span className="new-tag">NEW</span>
            </NavLink>
            <NavLink to="/settings">
              <GearSix size={21} />
              <span>Settings</span>
            </NavLink>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="capture-card">
            <span className="capture-doodle" aria-hidden="true">
              ✧
            </span>
            <strong>Catch a little thought.</strong>
            <p>
              Good ideas don’t wait.
              <br />
              Give yours a place to land.
            </p>
            <button onClick={openCapture}>
              <Plus size={15} />
              Quick capture<kbd>N</kbd>
            </button>
          </div>
          <div className="sidebar-health">
            <span className="status-dot" />
            {isDemo ? "Your local preview is ready" : "Your private workspace"}
            <span className="health-orbit">◎</span>
          </div>
          <button className="profile" onClick={() => setProfile(true)}>
            <span className="avatar">A</span>
            <span>
              <strong>Akshat Agarwal</strong>
              <small>A little curious, always.</small>
            </span>
            <CaretDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <List size={22} />
            </button>
            <span className="breadcrumb-home">My workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setSearch(true)}>
              <MagnifyingGlass size={17} />
              <span>Find anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="header-divider" />
            <button
              className="icon-button theme-toggle"
              aria-label="Toggle color theme"
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="icon-button bell"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={20} />
              <span />
            </button>
            <button
              className="header-avatar"
              aria-label="Open profile"
              onClick={() => setProfile(true)}
            >
              A
            </button>
          </div>
        </header>
        {(isDemo || offline) && (
          <div className="demo-banner">
            <span>
              {offline
                ? "You’re offline. Your local space is still here."
                : "A little preview of what’s possible. Sample data · Your changes stay in this browser."}
            </span>
            {isDemo && (
              <NavLink to="/integrations">
                Make it yours
                <ArrowUpRight size={13} />
              </NavLink>
            )}
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route
              path="/"
              element={<Dashboard onCapture={openCapture} onNote={editNote} />}
            />
            <Route path="/storage" element={<Storage notify={setToast} />} />
            <Route
              path="/notes"
              element={
                <Notes
                  onCapture={openCapture}
                  onNote={editNote}
                  notify={setToast}
                />
              }
            />
            <Route path="/sites" element={<Sites />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route
              path="/settings"
              element={<Settings theme={theme} setTheme={setTheme} />}
            />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>A little off course</h1>
                  <p>This page doesn’t exist yet.</p>
                  <NavLink className="primary" to="/">
                    Back to your orbit
                    <ArrowRight size={17} />
                  </NavLink>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
      {search && (
        <Search
          open={search}
          onClose={() => setSearch(false)}
          onCapture={openCapture}
        />
      )}
      {capture && (
        <Capture
          key={editing?.id || "new"}
          open={capture}
          onClose={() => setCapture(false)}
          notify={setToast}
          existing={editing}
        />
      )}
      <Modal
        open={notifications}
        onClose={() => setNotifications(false)}
        title="A little peace and quiet"
      >
        <div className="empty-state">
          <CheckCircle size={40} />
          <h2>You’re all caught up.</h2>
          <p>Nothing needs your attention. Enjoy a little breathing room.</p>
        </div>
      </Modal>
      <Modal
        open={profile}
        onClose={() => setProfile(false)}
        title="A little world of your own"
      >
        <div className="profile-modal">
          <span className="avatar">A</span>
          <h2>Akshat’s space</h2>
          <p>One person. Many little possibilities.</p>
          <span className="demo-pill">
            {isDemo ? "Private local preview" : "Private Google sign-in"}
          </span>
        </div>
        {!isDemo && (
          <form action="/api/auth/logout" method="post">
            <button className="secondary" type="submit">
              Sign out
            </button>
          </form>
        )}
        <button className="primary" onClick={() => setProfile(false)}>
          Back to my orbit
        </button>
      </Modal>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={21} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
