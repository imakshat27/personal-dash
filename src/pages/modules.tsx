import { indiaDate } from "../../shared/calendar";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Cloud,
  GithubLogo,
  CalendarBlank,
  HardDrives,
  CheckCircle,
  GearSix,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  ArrowRight,
  GlobeHemisphereWest,
  LinkSimple,
} from "@phosphor-icons/react";
import { api, isDemo, time } from "../lib/api";
import {
  Empty,
  ErrorState,
  Loading,
  Modal,
  Panel,
  Sparkline,
} from "../components/ui";
import type { Integration } from "../../shared/models";
export function Sites() {
  const data = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  if (data.isPending) return <Loading />;
  if (data.error)
    return (
      <ErrorState message={data.error.message} retry={() => data.refetch()} />
    );
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">THINGS YOU’VE PUT INTO THE WORLD</span>
          <h1>
            Sites & infrastructure<span className="title-dot">.</span>
          </h1>
          <p>A little peace of mind for the things you build.</p>
        </div>
        <span className="health-label">
          <CheckCircle size={18} />
          {isDemo ? "Sample infrastructure" : "Your infrastructure"}
        </span>
      </div>
      <div className="site-cards">
        {data.data.sites.map((s) => (
          <Panel title={s.name} key={s.id}>
            <div className="site-detail">
              <span className="site-address">
                <GlobeHemisphereWest size={16} />
                {s.url}
              </span>
              <span className="connected-pill">
                <span className="status-dot" />
                Online
              </span>
              <div className="site-stat">
                <strong>{s.visitors.toLocaleString()}</strong>
                <span>visitors this week · ↗ {s.change}%</span>
              </div>
              <Sparkline values={s.series} color="var(--green)" fill />
              <div className="site-metadata">
                <span>Cloudflare</span>
                <span>Sample analytics</span>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      {!data.data.sites.length && (
        <Empty
          title="Your next project belongs here"
          detail="The infrastructure module is ready for a Cloudflare analytics adapter. Configure it when you’re ready."
        />
      )}
      <div className="context-banner">
        <Cloud size={24} />
        <div>
          <strong>Ready for your real-world projects.</strong>
          <p>
            Cloudflare analytics and deployments will arrive through server-side
            provider adapters. The preview above uses sample data.
          </p>
        </div>
      </div>
    </>
  );
}
export function Calendar() {
  const [offset, setOffset] = useState(0);
  const selectedDate = indiaDate(new Date(Date.now() + offset * 86400000));
  const date = new Date(`${selectedDate}T12:00:00+05:30`);
  const data = useQuery({
    queryKey: ["calendar", selectedDate],
    queryFn: () => api.calendar(selectedDate),
  });
  if (data.isPending) return <Loading />;
  if (data.error)
    return (
      <ErrorState message={data.error.message} retry={() => data.refetch()} />
    );
  const events = data.data;
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
          <h1>
            A little look ahead<span className="title-dot">.</span>
          </h1>
          <p>Your time, with a little breathing room.</p>
        </div>
        <span className="health-label">
          <CalendarBlank size={19} />
          {isDemo ? "Sample calendar" : "Google Calendar · Read-only"}
        </span>
      </div>
      <section className="panel calendar-panel">
        <div className="calendar-controls">
          <h2>
            {date.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Asia/Kolkata",
            })}
          </h2>
          <div>
            <button className="secondary" onClick={() => setOffset(0)}>
              Today
            </button>
            <button
              className="icon-button"
              aria-label="Previous day"
              onClick={() => setOffset(offset - 1)}
            >
              <ArrowLeft size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Next day"
              onClick={() => setOffset(offset + 1)}
            >
              <ArrowRight size={19} />
            </button>
          </div>
        </div>
        <div className="calendar-day-label">
          {events.length} things on your radar · India Standard Time
        </div>
        {events.length ? (
          <div className="calendar-events">
            {events.map((e) => (
              <article key={e.id} className={`calendar-event ${e.color}`}>
                <div className="calendar-time">
                  {e.allDay ? "All day" : time(e.start)}
                  {!e.allDay && <span>{time(e.end)}</span>}
                </div>
                <div>
                  <h3>{e.title}</h3>
                  <p>{e.location}</p>
                </div>
                <CalendarBlank size={24} />
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="A little breathing room"
            detail="No events for this day. Make a little time for yourself."
          />
        )}
      </section>
      <div className="context-banner">
        <CalendarBlank size={24} />
        <div>
          <strong>One view for your days.</strong>
          <p>
            {isDemo
              ? "This preview shows sample events."
              : "Your primary Google calendar appears here with recurring and all-day events. Connect it from Integrations."}
          </p>
        </div>
      </div>
    </>
  );
}
export function Integrations() {
  const data = useQuery({
    queryKey: ["integrations"],
    queryFn: api.integrations,
  });
  const [selected, setSelected] = useState<Integration | null>(null);
  if (data.isPending) return <Loading />;
  if (data.error)
    return (
      <ErrorState message={data.error.message} retry={() => data.refetch()} />
    );
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">BRING YOUR WORLD TOGETHER</span>
          <h1>
            Better together<span className="title-dot">.</span>
          </h1>
          <p>Connect your favorite tools. Give them a shared home.</p>
        </div>
      </div>
      {["drive", "calendar"].map((id) => {
        const outcome = new URLSearchParams(window.location.search).get(id);
        if (!outcome) return null;
        const name = id === "drive" ? "Google Drive" : "Google Calendar";
        return (
          <div className="context-banner" key={id}>
            <CheckCircle size={24} />
            <p>
              {outcome === "connected"
                ? `${name} is connected. You’re ready to go.`
                : outcome === "cancelled"
                  ? "Google sign-in was cancelled. Connect whenever you’re ready."
                  : `${name} could not finish connecting. Check the setup and try again.`}
            </p>
          </div>
        );
      })}
      <div className="integration-grid">
        {data.data.map((i) => {
          const Icon =
            i.id === "github"
              ? GithubLogo
              : i.id === "calendar"
                ? CalendarBlank
                : i.id === "drive"
                  ? HardDrives
                  : Cloud;
          return (
            <article className="panel integration-card" key={i.id}>
              <div className="integration-top">
                <span className={`integration-icon ${i.id}`}>
                  <Icon size={29} />
                </span>
                <span
                  className={
                    i.status === "connected" ? "connected-pill" : "demo-pill"
                  }
                >
                  {i.status === "demo"
                    ? "Preview"
                    : i.status === "connected"
                      ? "Connected"
                      : i.status === "needs_reauth"
                        ? "Reconnect needed"
                        : "Not connected"}
                </span>
              </div>
              <small className="eyebrow">{i.category}</small>
              <h2>{i.name}</h2>
              <p>{i.description}</p>
              <button className="secondary" onClick={() => setSelected(i)}>
                <GearSix size={16} />
                {i.status === "connected" ? "View setup" : "Set up integration"}
                <ArrowUpRight size={15} />
              </button>
            </article>
          );
        })}
        <article className="future-integration">
          <LinkSimple size={30} />
          <h2>A growing little universe</h2>
          <p>
            New providers can join Orbit through independent adapters. There’s
            room for more.
          </p>
        </article>
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`${selected?.name || "Integration"} setup`}
      >
        <p className="modal-intro">{selected?.description}</p>
        {selected?.id === "drive" ? (
          <>
            <p>
              Use your existing Google Drive storage. Browse and download
              existing files; Orbit only edits files uploaded through Orbit.
            </p>
            <p>
              Uploads live in an Orbit folder in your Drive. Removing an Orbit
              upload sends it to Drive trash so you can restore it there.
            </p>
            {isDemo ? (
              <p>
                This preview stores changes in this browser. Connect your
                account after deployment to use your real Drive files.
              </p>
            ) : selected.configured ? (
              <a className="primary" href="/api/integrations/drive/connect">
                {selected.status === "connected"
                  ? "Reconnect Google Drive"
                  : "Connect Google Drive"}
              </a>
            ) : (
              <p>
                Your Drive connection isn’t ready yet. Complete the one-time
                account setup, then reload this page to connect.
              </p>
            )}
          </>
        ) : selected?.id === "calendar" ? (
          <>
            <p>
              See your primary Google calendar in Orbit, including recurring and
              all-day events. This connection can only read events.
            </p>
            {isDemo ? (
              <p>
                Connect your account after deployment to see your real events.
              </p>
            ) : selected.configured ? (
              <a className="primary" href="/api/integrations/calendar/connect">
                {selected.status === "connected"
                  ? "Reconnect Google Calendar"
                  : "Connect Google Calendar"}
              </a>
            ) : (
              <p>
                Finish the one-time Google account setup, then reload this page
                to connect.
              </p>
            )}
          </>
        ) : (
          <p>
            This provider’s live adapter is a future milestone. OAuth
            credentials will stay in the Worker when it is added.
          </p>
        )}
        <div className="context-banner compact">
          <CheckCircle size={22} />
          <span>Full setup instructions are in your project’s README.</span>
        </div>
        <button className="primary" onClick={() => setSelected(null)}>
          Got it
        </button>
      </Modal>
    </>
  );
}
export function Settings({
  theme,
  setTheme,
}: {
  theme: string;
  setTheme: (v: string) => void;
}) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>
            Your space, your way<span className="title-dot">.</span>
          </h1>
          <p>Just a few little things to make Orbit feel like you.</p>
        </div>
      </div>
      <Panel title="Look & feel" className="settings-panel">
        <p className="muted">Find your happy shade.</p>
        <div className="theme-options">
          {[
            { id: "light", label: "A little light", icon: Sun },
            { id: "dark", label: "After hours", icon: Moon },
            { id: "system", label: "Go with the flow", icon: Monitor },
          ].map((t) => (
            <button
              key={t.id}
              aria-pressed={theme === t.id}
              className={theme === t.id ? "selected" : ""}
              onClick={() => setTheme(t.id)}
            >
              <t.icon size={25} />
              <strong>{t.label}</strong>
              <small>
                {t.id === "system" ? "Match your device" : `${t.id} theme`}
              </small>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Your private little universe" className="settings-panel">
        <div className="setting-row">
          <div>
            <strong>Data mode</strong>
            <p>
              {isDemo
                ? "Demo · Changes stay in this browser"
                : "Live · Connected to your private Worker API"}
            </p>
          </div>
          <span className="demo-pill">{isDemo ? "Local preview" : "Live"}</span>
        </div>
        <div className="setting-row">
          <div>
            <strong>Keyboard shortcuts</strong>
            <p>Find your way a little faster.</p>
          </div>
          <span>
            <kbd>⌘ K</kbd> Search <kbd>N</kbd> New note
          </span>
        </div>
        <div className="setting-row">
          <div>
            <strong>Install Orbit</strong>
            <p>
              Use your browser’s “Install app” or “Add to Home Screen” menu.
            </p>
          </div>
          <span className="muted">PWA ready</span>
        </div>
      </Panel>
    </>
  );
}
