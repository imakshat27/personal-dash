import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  UploadSimple,
  ArrowRight,
  Check,
} from "@phosphor-icons/react";
import { api, isDemo } from "../lib/api";
import { Modal } from "./ui";
import type { Note } from "../../shared/models";
export function Capture({
  open,
  onClose,
  notify,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  notify: (message: string) => void;
  existing?: Note;
}) {
  const [tab, setTab] = useState<"note" | "file">("note");
  const [title, setTitle] = useState(existing?.title || "");
  const [content, setContent] = useState(existing?.body || "");
  const [color, setColor] = useState<Note["color"]>(existing?.color || "sage");
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState("/Documents");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (tab === "note") {
        return api.saveNote(
          { title, body: content, color, pinned: existing?.pinned || false },
          existing?.id,
        );
      }
      if (!file) throw new Error("Choose a file first.");
      return api.upload(file, path);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["notes"] });
      client.invalidateQueries({ queryKey: ["files"] });
      client.invalidateQueries({ queryKey: ["usage"] });
      notify(
        tab === "note"
          ? "A little thought, safely captured."
          : "File uploaded. A little more organized.",
      );
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? "Edit your note" : "Make a little space"}
    >
      <p className="modal-intro">
        An idea, a file, a small thing worth keeping.
      </p>
      {!existing && (
        <div className="segmented capture-tabs">
          <button
            className={tab === "note" ? "selected" : ""}
            onClick={() => setTab("note")}
          >
            <FileText size={18} />
            Write a note
          </button>
          <button
            className={tab === "file" ? "selected" : ""}
            onClick={() => setTab("file")}
          >
            <UploadSimple size={18} />
            Upload a file
          </button>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {tab === "note" ? (
          <>
            <label htmlFor="note-title">Title</label>
            <input
              autoFocus
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What’s on your mind?"
              required
              maxLength={200}
            />
            <label htmlFor="note-content">Your note</label>
            <textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Let the thoughts out…"
              rows={7}
              maxLength={50000}
            />
            <div className="color-picker">
              <span>A little color</span>
              {(["sage", "lavender", "sand"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`color-dot ${c}`}
                  aria-label={`${c} note color`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                >
                  {color === c && <Check size={16} />}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="drop-zone" htmlFor="upload-file">
              <UploadSimple size={32} />
              <strong>
                {file ? file.name : "Choose a file to bring into Orbit"}
              </strong>
              <span>
                Up to 25 MB · Stored in{" "}
                {isDemo ? "this browser" : "Google Drive"}
              </span>
              <input
                id="upload-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </label>
            <label htmlFor="upload-folder">Virtual folder</label>
            <select
              id="upload-folder"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            >
              {["/Documents", "/Design", "/Photos", "/Archives"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </>
        )}
        {mutation.error && (
          <p className="form-error" role="alert">
            {mutation.error.message}
          </p>
        )}
        <div className="modal-footer">
          <span>
            {isDemo ? "Saved locally in this browser" : "Your private space"}
          </span>
          <button
            type="submit"
            className="primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Saving…"
              : tab === "note"
                ? "Save note"
                : "Upload file"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
