CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
