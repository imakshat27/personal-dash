import { useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Cloud,
  UploadSimple,
  FolderSimple,
  MagnifyingGlass,
  SquaresFour,
  List,
  DownloadSimple,
  Trash,
  PencilSimple,
  ArrowRight,
  X,
} from "@phosphor-icons/react";
import { api, bytes, isDemo } from "../lib/api";
import { FileIcon } from "./dashboard";
import { Empty, ErrorState, Loading, Modal } from "../components/ui";
import type { StorageFile } from "../../shared/models";
export function Storage({ notify }: { notify: (s: string) => void }) {
  const client = useQueryClient();
  const pages = useInfiniteQuery({
    queryKey: ["files", "pages"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.filePage(pageParam),
    getNextPageParam: (page) => page.nextCursor,
  });
  const files = {
    ...pages,
    data: pages.data?.pages.flatMap((page) => page.files) || [],
  };
  const { data: usage = [] } = useQuery({
    queryKey: ["usage"],
    queryFn: api.usage,
  });
  const [folder, setFolder] = useState("All files");
  const [provider, setProvider] = useState("all");
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(false);
  const [selected, setSelected] = useState<StorageFile | null>(null);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      api.upload(file, folder === "All files" ? "/Documents" : `/${folder}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["files"] });
      client.invalidateQueries({ queryKey: ["usage"] });
      notify("Your file has a new home.");
    },
  });
  const edit = useMutation({
    mutationFn: () => api.updateFile(selected!.id, { name, virtualPath: path }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["files"] });
      setSelected(null);
      notify("File updated. Nice and tidy.");
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteFile(selected!.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["files"] });
      client.invalidateQueries({ queryKey: ["usage"] });
      setSelected(null);
      notify(isDemo ? "File deleted." : "File moved to Drive trash.");
    },
  });
  async function download(file: StorageFile) {
    try {
      const blob = await api.download(file);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = blob instanceof File ? blob.name : file.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify((error as Error).message);
    }
  }
  if (files.isPending) return <Loading />;
  if (files.error)
    return (
      <ErrorState message={files.error.message} retry={() => files.refetch()} />
    );
  const visible = files.data.filter(
    (f) =>
      (provider === "all" || f.provider === provider) &&
      (folder === "All files" || f.virtualPath === `/${folder}`) &&
      f.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">A HOME FOR EVERYTHING</span>
          <h1>
            My storage<span className="title-dot">.</span>
          </h1>
          <p>Different clouds. One little space.</p>
        </div>
        <button
          className="primary"
          onClick={() => input.current?.click()}
          disabled={upload.isPending}
        >
          <UploadSimple size={18} />
          {upload.isPending ? "Uploading…" : "Upload file"}
        </button>
        <input
          className="visually-hidden"
          ref={input}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
          aria-label="Upload file"
        />
      </div>
      {!isDemo && !usage.length && (
        <div className="context-banner">
          <Cloud size={24} />
          <div>
            <strong>Bring your Drive into Orbit.</strong>
            <p>
              Connect Google Drive in Integrations to browse your files and use
              your existing storage.
            </p>
            <a className="secondary" href="/integrations">
              Open integrations
            </a>
          </div>
        </div>
      )}
      <div className="storage-overview">
        {usage.map((u) => (
          <button
            className={`storage-provider ${u.provider}`}
            key={u.provider}
            onClick={() =>
              setProvider(provider === u.provider ? "all" : u.provider)
            }
            aria-pressed={provider === u.provider}
          >
            <span className="provider-symbol">
              <Cloud size={24} />
            </span>
            <div>
              <strong>{u.label}</strong>
              <p>
                {bytes(u.used)} used
                {u.capacity ? ` of ${bytes(u.capacity)}` : " · Grows with you"}
              </p>
              <div className="usage-bar">
                <span
                  style={{
                    width: u.capacity
                      ? `${Math.min(100, (u.used / u.capacity) * 100)}%`
                      : "30%",
                  }}
                />
              </div>
            </div>
            <ArrowRight size={20} />
          </button>
        ))}
      </div>
      <div className="storage-layout">
        <aside className="folder-sidebar">
          <span className="eyebrow">YOUR LITTLE LIBRARY</span>
          {[
            "All files",
            "Drive",
            "Documents",
            "Design",
            "Photos",
            "Archives",
          ].map((f) => (
            <button
              className={folder === f ? "active" : ""}
              key={f}
              onClick={() => setFolder(f)}
            >
              <FolderSimple size={19} />
              {f}
              <small>
                {
                  files.data.filter(
                    (file) => f === "All files" || file.virtualPath === `/${f}`,
                  ).length
                }
              </small>
            </button>
          ))}
          <div className="storage-tip">
            <SparkleMark />
            <strong>Everything in its place.</strong>
            <p>Files stay on their own cloud. Orbit brings them together.</p>
          </div>
        </aside>
        <section className="panel file-browser">
          <div className="file-toolbar">
            <h2>{folder}</h2>
            <div className="file-search">
              <MagnifyingGlass size={17} />
              <input
                aria-label="Search files"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a file…"
              />
            </div>
            {provider !== "all" && (
              <button
                className="filter-pill"
                onClick={() => setProvider("all")}
              >
                {provider === "r2" ? "R2" : "Drive"}
                <X size={13} />
              </button>
            )}
            <div className="view-toggle">
              <button
                aria-label="List view"
                aria-pressed={!grid}
                onClick={() => setGrid(false)}
              >
                <List size={20} />
              </button>
              <button
                aria-label="Grid view"
                aria-pressed={grid}
                onClick={() => setGrid(true)}
              >
                <SquaresFour size={20} />
              </button>
            </div>
          </div>
          {upload.error && (
            <p className="form-error" role="alert">
              {upload.error.message}
            </p>
          )}
          {visible.length ? (
            <div className={grid ? "file-grid" : "file-list"}>
              {!grid && (
                <div className="file-table-labels">
                  <span>NAME</span>
                  <span>PROVIDER</span>
                  <span>SIZE</span>
                  <span />
                </div>
              )}
              {visible.map((file) => (
                <div className="file-browser-row" key={file.id}>
                  <button
                    className="file-details"
                    onClick={() => {
                      setSelected(file);
                      setName(file.name);
                      setPath(file.virtualPath);
                      edit.reset();
                      remove.reset();
                    }}
                  >
                    <FileIcon file={file} />
                    <span>
                      <strong>{file.name}</strong>
                      <small>{file.virtualPath}</small>
                    </span>
                  </button>
                  <span className={`provider-tag ${file.provider}`}>
                    <span className="status-dot" />
                    {file.provider === "r2" ? "R2" : "Google Drive"}
                  </span>
                  <span className="file-size">{bytes(file.size)}</span>
                  <button
                    className="icon-button"
                    aria-label={`Download ${file.name}`}
                    onClick={() => download(file)}
                  >
                    <DownloadSimple size={19} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="A little room for something new"
              detail={
                query
                  ? "No files match your search. Try another name."
                  : "Upload a file and make this folder your own."
              }
              action={
                <button
                  className="secondary"
                  onClick={() => input.current?.click()}
                >
                  Upload your first file
                </button>
              }
            />
          )}
          {pages.hasNextPage && (
            <button
              className="secondary"
              onClick={() => pages.fetchNextPage()}
              disabled={pages.isFetchingNextPage}
            >
              {pages.isFetchingNextPage ? "Loading…" : "Load more Drive files"}
            </button>
          )}
          {pages.isFetchNextPageError && (
            <p className="form-error">
              Could not load the next page. Try again.
            </p>
          )}
          <div className="panel-foot">
            {visible.length} files
            {isDemo
              ? " · Sample files and your local uploads"
              : " · Files remain in their original provider"}
          </div>
        </section>
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="A place for this file"
      >
        {selected?.writable === false && (
          <p className="muted">
            This existing Drive file is available to view and download. Orbit
            only edits files uploaded through Orbit.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selected?.writable === false) return;
            edit.mutate();
          }}
        >
          <label htmlFor="file-name">File name</label>
          <input
            id="file-name"
            value={name}
            required
            readOnly={selected?.writable === false}
            maxLength={255}
            pattern="[^/\\]+"
            onChange={(e) => setName(e.target.value)}
          />
          <label htmlFor="file-folder">Virtual folder</label>
          <select
            id="file-folder"
            disabled={selected?.writable === false}
            value={path}
            onChange={(e) => setPath(e.target.value)}
          >
            {["/Drive", "/Documents", "/Design", "/Photos", "/Archives"].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
          <p className="muted">
            {selected && bytes(selected.size)} ·{" "}
            {selected?.provider === "r2" ? "Cloudflare R2" : "Google Drive"}
          </p>
          {(edit.error || remove.error) && (
            <p className="form-error" role="alert">
              {(edit.error || remove.error)?.message}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${selected?.name} from Orbit? Drive uploads go to trash.`,
                  )
                )
                  remove.mutate();
              }}
              disabled={remove.isPending || selected?.writable === false}
            >
              <Trash size={18} />
              {selected?.provider === "drive" && !isDemo
                ? "Move to trash"
                : "Delete"}
            </button>
            <button
              className="primary"
              disabled={
                edit.isPending ||
                remove.isPending ||
                selected?.writable === false
              }
            >
              <PencilSimple size={17} />
              {edit.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
function SparkleMark() {
  return (
    <span className="tip-star" aria-hidden="true">
      ✧
    </span>
  );
}
