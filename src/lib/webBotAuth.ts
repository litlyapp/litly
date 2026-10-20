// Web Bot Auth (HTTP Message Signatures, RFC 9421, Cloudflare profile) for
// litly's URL importer. Signing lets Cloudflare-protected sites recognise the
// importer as a declared, verified agent instead of an anonymous bot.
// https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/
//
// Key: WEB_BOT_AUTH_PRIVATE_KEY = Ed25519 private key as a JWK JSON string
// (generate with `node scripts/generate-web-bot-auth-key.js`). Unset = requests
// go out unsigned and the key directory serves an empty set.
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, type KeyObject } from "crypto";

export const IMPORTER_USER_AGENT = "litly-importer/1.0 (+https://thelitlyapp.com/importer)";
export const SIGNATURE_AGENT_ORIGIN = "https://thelitlyapp.com";
export const KEY_DIRECTORY_PATH = "/.well-known/http-message-signatures-directory";

// Cloudflare suggests keeping signatures short-lived; a minute covers transit.
// (Its profile also requires a 64-byte nonce.)
const REQUEST_SIGNATURE_TTL_S = 60;
// The directory may be cached by verifiers, so its signature lives longer
const DIRECTORY_SIGNATURE_TTL_S = 300;

type PublicJwk = { kty: "OKP"; crv: "Ed25519"; x: string };

let cached: { privateKey: KeyObject; publicJwk: PublicJwk; keyid: string } | null | undefined;

function loadKey() {
  if (cached !== undefined) return cached;
  const raw = process.env.WEB_BOT_AUTH_PRIVATE_KEY;
  if (!raw) return (cached = null);
  try {
    const privateKey = createPrivateKey({ key: JSON.parse(raw), format: "jwk" });
    const { x } = createPublicKey(privateKey).export({ format: "jwk" }) as { x: string };
    const publicJwk: PublicJwk = { kty: "OKP", crv: "Ed25519", x };
    // JWK thumbprint (RFC 7638 / RFC 8037 A.3): required members in lexicographic order
    const keyid = createHash("sha256")
      .update(JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x }))
      .digest("base64url");
    return (cached = { privateKey, publicJwk, keyid });
  } catch (err) {
    console.error("[webBotAuth] WEB_BOT_AUTH_PRIVATE_KEY is not a valid Ed25519 JWK:", err);
    return (cached = null);
  }
}

export function publicKeyDirectory(): { keys: PublicJwk[] } {
  const key = loadKey();
  return { keys: key ? [key.publicJwk] : [] };
}

// Builds Signature-Input / Signature over the given components (RFC 9421 §2.5).
// Component values must already be exactly what goes on the wire.
function signComponents(
  components: [name: string, value: string][],
  tag: string,
  ttlSeconds: number,
): { "Signature-Input": string; Signature: string } | null {
  const key = loadKey();
  if (!key) return null;
  const created = Math.floor(Date.now() / 1000);
  const params =
    `(${components.map(([name]) => `"${name}"`).join(" ")})` +
    `;created=${created};expires=${created + ttlSeconds}` +
    `;keyid="${key.keyid}";alg="ed25519"` +
    `;nonce="${randomBytes(64).toString("base64url")}";tag="${tag}"`;
  const base = [
    ...components.map(([name, value]) => `"${name}": ${value}`),
    `"@signature-params": ${params}`,
  ].join("\n");
  const signature = sign(null, Buffer.from(base, "utf8"), key.privateKey).toString("base64");
  return { "Signature-Input": `sig1=${params}`, Signature: `sig1=:${signature}:` };
}

// Headers for an outgoing importer fetch: the honest UA, plus a signature when a key is configured.
export function importerRequestHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": IMPORTER_USER_AGENT };
  const signatureAgent = `"${SIGNATURE_AGENT_ORIGIN}"`;
  const signed = signComponents(
    [["@authority", new URL(url).host.toLowerCase()], ["signature-agent", signatureAgent]],
    "web-bot-auth",
    REQUEST_SIGNATURE_TTL_S,
  );
  if (signed) Object.assign(headers, { "Signature-Agent": signatureAgent }, signed);
  return headers;
}

// Signature headers for the key-directory response itself (covers the host it was served on).
export function directoryResponseHeaders(authority: string): Record<string, string> {
  return (
    signComponents([["@authority", authority.toLowerCase()]], "http-message-signatures-directory", DIRECTORY_SIGNATURE_TTL_S) ??
    {}
  );
}
