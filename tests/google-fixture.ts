import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
const pair = await generateKeyPair("RS256", { extractable: true });
export const jwks = {
  keys: [
    {
      ...(await exportJWK(pair.publicKey)),
      kid: "orbit-test",
      alg: "RS256",
      use: "sig",
    },
  ],
};
export const localKeys = createLocalJWKSet(jwks);
export function googleToken(
  nonce: string,
  claims: Record<string, unknown> = {},
) {
  return new SignJWT({
    email: "owner@gmail.com",
    email_verified: true,
    nonce,
    iss: "https://accounts.google.com",
    aud: "client-id",
    sub: "google-owner",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "orbit-test" })
    .sign(pair.privateKey);
}
