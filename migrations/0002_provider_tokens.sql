-- Tokens are encrypted with a Worker-only AES-GCM key before storage.
CREATE TABLE provider_tokens (provider TEXT PRIMARY KEY, encrypted_tokens TEXT NOT NULL, updated_at TEXT NOT NULL);
