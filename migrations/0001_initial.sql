CREATE TABLE files (id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_id TEXT NOT NULL, name TEXT NOT NULL, virtual_path TEXT NOT NULL DEFAULT '/', mime_type TEXT NOT NULL, size INTEGER NOT NULL CHECK(size >= 0), modified_at TEXT NOT NULL, UNIQUE(provider, provider_id));
CREATE INDEX files_path ON files(virtual_path);
CREATE INDEX files_name ON files(name COLLATE NOCASE);
CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT 'sage', pinned INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE integrations (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'not_configured', last_sync_at TEXT, settings_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
