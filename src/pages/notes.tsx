import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  PushPin,
  Trash,
  MagnifyingGlass,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { api } from "../lib/api";
import type { Note } from "../../shared/models";
import { Empty, ErrorState, Loading } from "../components/ui";
export function Notes({
  onCapture,
  onNote,
  notify,
}: {
  onCapture: () => void;
  onNote: (n: Note) => void;
  notify: (s: string) => void;
}) {
  const [query, setQuery] = useState("");
  const client = useQueryClient();
  const notes = useQuery({ queryKey: ["notes"], queryFn: api.notes });
  const pin = useMutation({
    mutationFn: (n: Note) => api.saveNote({ ...n, pinned: !n.pinned }, n.id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e) => notify(e.message),
  });
  const remove = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["notes"] });
      notify("Note deleted.");
    },
    onError: (e) => notify(e.message),
  });
  if (notes.isPending) return <Loading />;
  if (notes.error)
    return (
      <ErrorState message={notes.error.message} retry={() => notes.refetch()} />
    );
  const visible = notes.data
    .filter((n) =>
      `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">LET THE IDEAS LAND</span>
          <h1>
            Room for your thoughts<span className="title-dot">.</span>
          </h1>
          <p>Big ideas. Small reminders. Things worth keeping.</p>
        </div>
        <button className="primary" onClick={onCapture}>
          <Plus size={18} />
          New note
        </button>
      </div>
      <div className="notes-toolbar">
        <span>{notes.data.length} little thoughts</span>
        <div className="file-search">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search notes"
            placeholder="Find a thought…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="notes-grid">
        {visible.map((n) => (
          <article className={`note-card ${n.color}`} key={n.id}>
            <div className="note-card-top">
              <span className="eyebrow">
                {n.pinned ? "PINNED THOUGHT" : "A LITTLE THOUGHT"}
              </span>
              <button
                className="icon-button"
                onClick={() => pin.mutate(n)}
                aria-label={n.pinned ? "Unpin note" : "Pin note"}
                aria-pressed={n.pinned}
              >
                <PushPin size={18} weight={n.pinned ? "fill" : "regular"} />
              </button>
            </div>
            <button className="note-card-body" onClick={() => onNote(n)}>
              <h2>{n.title}</h2>
              <p>{n.body}</p>
            </button>
            <div className="note-card-footer">
              <span>
                {new Date(n.updatedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label={`Delete ${n.title}`}
                  onClick={() => {
                    if (confirm("Delete this note? This cannot be undone."))
                      remove.mutate(n.id);
                  }}
                >
                  <Trash size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Edit ${n.title}`}
                  onClick={() => onNote(n)}
                >
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </div>
          </article>
        ))}
        <button className="new-note-card" onClick={onCapture}>
          <span>
            <Plus size={25} />
          </span>
          <strong>Your next idea lives here.</strong>
          <p>Give it a little space.</p>
        </button>
      </div>
      {!visible.length && query && (
        <Empty
          title="That thought is still out there"
          detail="Try another word, or capture a new idea."
        />
      )}
    </>
  );
}
