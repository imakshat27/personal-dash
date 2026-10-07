import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  GlobeHemisphereWest,
  Cloud,
  GitBranch,
  FileText,
  Plus,
  PaperPlaneTilt,
  Sparkle,
  CheckCircle,
  DotsThree,
  ArrowDown,
  FolderSimple,
  CalendarBlank,
} from "@phosphor-icons/react";
import { api, bytes, time, isDemo } from "../lib/api";
import { siteCount, siteValue } from "../../shared/models";
import { Panel, Sparkline, Loading, ErrorState } from "../components/ui";
import type { StorageFile, Note } from "../../shared/models";
export function FileIcon({ file }: { file: StorageFile }) {
  return (
    <span
      className={`file-icon ${file.mimeType.startsWith("image") ? "image" : file.name.endsWith(".fig") ? "design" : file.mimeType === "application/pdf" ? "pdf" : "document"}`}
    >
      <FileText size={21} />
    </span>
  );
}
export function Dashboard({
  onCapture,
  onNote,
}: {
  onCapture: () => void;
  onNote: (note: Note) => void;
}) {
  const navigate = useNavigate();
  const data = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
    staleTime: 60000,
  });
  const { data: files = [] } = useQuery({
    queryKey: ["files"],
    queryFn: api.files,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: api.notes,
  });
  const { data: usage = [] } = useQuery({
    queryKey: ["usage"],
    queryFn: api.usage,
  });
  if (data.isPending) return <Loading />;
  if (data.error)
    return (
      <ErrorState message={data.error.message} retry={() => data.refetch()} />
    );
  const totalVisitors = data.data.sites.reduce(
    (sum, s) => sum + siteCount(s),
    0,
  );
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="date-line">
            <span className="little-sun">☼</span>
            {date}
          </div>
          <h1>
            A little more together<span className="title-dot">.</span>
          </h1>
          <p>Your digital world, all in one happy place.</p>
        </div>
        <button className="secondary" onClick={onCapture}>
          <Plus size={17} />
          Quick capture<kbd>N</kbd>
        </button>
      </div>
      <div className="dashboard-top">
        <section className="welcome-card">
          <div className="welcome-copy">
            <span className="eyebrow">YOUR SPACE. YOUR PACE.</span>
            <h2>
              Hey Akshat,
              <br />
              welcome to your orbit.
            </h2>
            <p>
              Less tab hopping.
              <br />
              More doing what you love.
            </p>
            <button onClick={() => navigate("/storage")}>
              Explore your space
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="orbital-art" aria-hidden="true">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="orbit-ring ring-three" />
            <div className="planet-main">
              <span className="planet-eye" />
              <span className="planet-eye" />
              <span className="planet-smile" />
            </div>
            <span className="orbit-star star-one">✧</span>
            <span className="orbit-star star-two">✦</span>
            <span className="orbit-star star-three">✧</span>
            <div className="satellite satellite-cloud">
              <Cloud size={24} weight="duotone" />
            </div>
            <div className="satellite satellite-note">
              <FileText size={23} weight="duotone" />
            </div>
            <div className="tiny-planet" />
          </div>
          <span className="welcome-bottom">
            <span className="status-dot" />A little space for everything
          </span>
        </section>
        <div className="metrics-grid">
          <Metric
            label="Your sites"
            value={String(data.data.sites.length).padStart(2, "0")}
            detail={isDemo ? "All systems feeling good" : "Connected sites"}
            icon={<GlobeHemisphereWest size={20} />}
            color="sage"
            onClick={() => navigate("/sites")}
          >
            <span className="metric-status">
              <span className="status-dot" />
              {isDemo
                ? "All online"
                : data.data.sites.length
                  ? "Zones connected"
                  : "Awaiting integration"}
            </span>
          </Metric>
          <Metric
            label={isDemo ? "Visitors this week" : "Requests · Last 24h"}
            value={
              data.data.sites.some((s) => s.requests === null)
                ? "—"
                : totalVisitors.toLocaleString()
            }
            detail={
              isDemo
                ? "+12.8% from last week"
                : data.data.sites.length
                  ? "Estimated HTTP traffic · Completed hours"
                  : "Connect analytics to begin"
            }
            icon={<ArrowUpRight size={20} />}
            color="lavender"
            onClick={() => navigate("/sites")}
          >
            <Sparkline
              values={
                isDemo
                  ? [12, 15, 13, 22, 20, 31, 28, 37, 33, 43, 40, 53]
                  : Array.from({ length: 24 }, (_, i) =>
                      data.data.sites.reduce(
                        (sum, s) => sum + (s.series[i] || 0),
                        0,
                      ),
                    )
              }
              color="var(--purple)"
            />
          </Metric>
          <Metric
            label="A home for your files"
            value={bytes(usage.reduce((sum, u) => sum + u.used, 0))}
            detail={`${usage.length} storage providers${isDemo ? " · Sample usage" : ""}`}
            icon={<Cloud size={20} />}
            color="sand"
            onClick={() => navigate("/storage")}
          >
            <div className="mini-storage">
              <span />
              <span />
            </div>
          </Metric>
          <Metric
            label="Room for your thoughts"
            value={String(notes.length).padStart(2, "0")}
            detail={`${notes.filter((n) => n.pinned).length} pinned · All yours`}
            icon={<FileText size={20} />}
            color="pink"
            onClick={() => navigate("/notes")}
          >
            <span className="metric-note">
              An idea starts here
              <Sparkle size={14} />
            </span>
          </Metric>
        </div>
      </div>
      <div className="dashboard-middle">
        <Panel
          title="Your sites, at a glance"
          action={{ label: "All sites", onClick: () => navigate("/sites") }}
          className="sites-panel"
        >
          <div className="table-caption">
            <span>WEBSITE</span>
            <span>{isDemo ? "VISITORS" : "REQUESTS"}</span>
            <span>{isDemo ? "LAST 7 DAYS" : "LAST 24 HOURS"}</span>
          </div>
          {data.data.sites.map((site) => (
            <button
              className="site-row"
              key={site.id}
              onClick={() => navigate("/sites")}
            >
              <span className="site-name">
                <span className={`site-favicon ${site.id}`}>
                  <GlobeHemisphereWest size={19} />
                </span>
                <span>
                  <strong>{site.name}</strong>
                  <small>
                    {site.url}
                    <span className="status-dot" />
                  </small>
                </span>
              </span>
              <span className="site-numbers">
                <strong>{siteValue(site)}</strong>
                <small>
                  {site.change === null
                    ? "No comparison"
                    : `${site.change >= 0 ? "↗" : "↘"} ${site.change}%`}
                </small>
              </span>
              <Sparkline values={site.series} color="var(--green)" />
            </button>
          ))}
          {!data.data.sites.length && (
            <div className="small-empty">
              {data.data.integrationErrors?.cloudflare ||
                "Connect a site to start seeing its story."}
            </div>
          )}
          <div className="panel-foot">
            <CheckCircle size={15} />
            {isDemo
              ? "Sample analytics · Connect Cloudflare to see your sites"
              : "Cloudflare zone traffic · Estimates, not visitor counts"}
          </div>
        </Panel>
        <Panel
          title="A little look ahead"
          action={{ label: "Calendar", onClick: () => navigate("/calendar") }}
          className="agenda-panel"
        >
          <div className="agenda-date">
            <span>Today</span>
            <small>{data.data.events.length} things on your radar</small>
          </div>
          {data.data.events.map((event) => (
            <button
              className={`agenda-event ${event.color}`}
              key={event.id}
              onClick={() => navigate("/calendar")}
            >
              <span className="event-time">
                {event.allDay ? "All day" : time(event.start)}
                {!event.allDay && <small>{time(event.end)}</small>}
              </span>
              <span className="event-title">
                <strong>{event.title}</strong>
                <small>{event.location}</small>
              </span>
            </button>
          ))}
          {!data.data.events.length && (
            <div className="small-empty">
              {data.data.integrationErrors?.calendar ||
                "A clear calendar. A little breathing room."}
            </div>
          )}
          <div className="agenda-bottom">
            <CalendarBlank size={15} />
            Make room for a little you-time.
          </div>
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <Panel
          title="Recently in your orbit"
          action={{ label: "All files", onClick: () => navigate("/storage") }}
        >
          <div className="recent-files">
            {files.slice(0, 3).map((file) => (
              <button
                key={file.id}
                className="recent-file"
                onClick={() => navigate("/storage")}
              >
                <FileIcon file={file} />
                <span>
                  <strong>{file.name}</strong>
                  <small>
                    {file.provider === "r2" ? "Cloudflare R2" : "Google Drive"}
                    <span>·</span>
                    {bytes(file.size)}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel
          title="A thought to keep"
          action={{ label: "All notes", onClick: () => navigate("/notes") }}
        >
          <button
            className={`note-preview ${notes[0]?.color || "sage"}`}
            onClick={() => (notes[0] ? onNote(notes[0]) : onCapture())}
          >
            <div>
              <span className="eyebrow">
                <FileText size={13} />
                {notes[0]?.pinned ? "PINNED NOTE" : "YOUR NOTE"}
              </span>
              <DotsThree size={22} />
            </div>
            <h3>{notes[0]?.title || "Your next idea lives here"}</h3>
            <p>
              {notes[0]?.body.split("\n")[0] ||
                "Capture a little thought. See where it takes you."}
            </p>
            <span className="note-preview-footer">
              {notes[0] ? "Open your thought" : "Write a note"}
              <ArrowUpRight size={16} />
            </span>
          </button>
        </Panel>
        <Panel title="Little things happening">
          <div className="activity-list">
            {data.data.activity.map((a) => (
              <div className="activity-item" key={a.id}>
                <span className={`activity-icon ${a.type}`}>
                  {a.type === "deploy" ? (
                    <PaperPlaneTilt size={18} />
                  ) : a.type === "file" ? (
                    <ArrowDown size={18} />
                  ) : (
                    <GitBranch size={18} />
                  )}
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.detail}</small>
                  <time>{a.time}</time>
                </div>
              </div>
            ))}
          </div>
          {!data.data.activity.length && (
            <div className="small-empty">
              <FolderSimple size={24} />
              Your next chapter starts here.
            </div>
          )}
        </Panel>
      </div>
      <div className="dashboard-footer">
        <span>
          <span className="tiny-orbit">◎</span> A little space. A lot of
          possibilities.
        </span>
        <span>Made for you, by you.</span>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
  color,
  children,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="metric-card" onClick={onClick}>
      <div className="metric-heading">
        <span>{label}</span>
        <span className={`metric-icon ${color}`}>{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <p>{detail}</p>
      <div className="metric-visual">{children}</div>
    </button>
  );
}
