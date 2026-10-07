import { base64url } from "jose";
import { ProviderError } from "./providers/errors";
async function key(secret: string) {
  const bytes = base64url.decode(secret);
  if (bytes.length !== 32)
    throw new ProviderError("Token encryption key must contain 32 bytes.", 503);
  return crypto.subtle.importKey(
    "raw",
    bytes as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(value: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(secret),
    data,
  );
  return `${base64url.encode(iv)}.${base64url.encode(new Uint8Array(encrypted))}`;
}
export async function unseal<T>(value: string, secret: string): Promise<T> {
  const [iv, data] = value.split(".");
  const decoded = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64url.decode(iv) as BufferSource },
    await key(secret),
    base64url.decode(data) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(decoded));
}
