import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  MagnifyingGlass,
  ArrowElbowDownLeft,
  FileText,
  Folder,
  Planet,
} from "@phosphor-icons/react";
import { api } from "../lib/api";
import { Modal } from "./ui";
const pages = [
  ["Dashboard", "/"],
  ["My storage", "/storage"],
  ["Sites & infra", "/sites"],
  ["Calendar", "/calendar"],
  ["Notes", "/notes"],
  ["Integrations", "/integrations"],
  ["Settings", "/settings"],
];
export function Search({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: () => void;
}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { data: files = [] } = useQuery({
    queryKey: ["files"],
    queryFn: api.files,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: api.notes,
  });
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
  });
  const q = query.toLowerCase();
  const results = [
    ...pages.map(([title, path]) => ({
      id: path,
      title,
      detail: "Go to page",
      path,
      icon: Planet,
    })),
    ...files.map((f) => ({
      id: f.id,
      title: f.name,
      detail: `File · ${f.provider === "r2" ? "Cloudflare R2" : "Google Drive"}`,
      path: "/storage",
      icon: Folder,
    })),
    ...notes.map((n) => ({
      id: n.id,
      title: n.title,
      detail: "Note",
      path: "/notes",
      icon: FileText,
    })),
    ...(dashboard?.sites || []).map((s) => ({
      id: s.id,
      title: s.name,
      detail: s.url,
      path: "/sites",
      icon: Planet,
    })),
    ...(dashboard?.events || []).map((e) => ({
      id: e.id,
      title: e.title,
      detail: "Calendar event",
      path: "/calendar",
      icon: Planet,
    })),
  ]
    .filter((r) => `${r.title} ${r.detail}`.toLowerCase().includes(q))
    .slice(0, 12);
  return (
    <Modal open={open} onClose={onClose} title="Find your way" wide>
      <div className="search-input">
        <MagnifyingGlass size={22} />
        <input
          ref={inputRef}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              resultRefs.current[0]?.focus();
            }
            if (event.key === "Enter" && results[0]) {
              navigate(results[0].path);
              onClose();
            }
          }}
          aria-label="Search everything"
          placeholder="Search files, notes, pages, and more…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>esc</kbd>
      </div>
      <p className="eyebrow search-label">
        {query ? "RESULTS" : "JUMP TO YOUR SPACE"}
      </p>
      <div className="search-results">
        {results.map((r, index) => (
          <button
            key={r.id}
            ref={(element) => {
              resultRefs.current[index] = element;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                resultRefs.current[(index + 1) % results.length]?.focus();
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (index === 0) inputRef.current?.focus();
                else resultRefs.current[index - 1]?.focus();
              }
            }}
            onClick={() => {
              navigate(r.path);
              onClose();
            }}
          >
            <r.icon size={20} />
            <span>
              <strong>{r.title}</strong>
              <small>{r.detail}</small>
            </span>
            <ArrowElbowDownLeft size={16} />
          </button>
        ))}
        {!results.length && (
          <p className="muted">Nothing here yet. Try a different search.</p>
        )}
      </div>
      <button
        className="search-capture"
        onClick={() => {
          onClose();
          onCapture();
        }}
      >
        + Capture a new thought
      </button>
    </Modal>
  );
}
