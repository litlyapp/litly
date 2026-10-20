// One-off: generate the Ed25519 key for the importer's Web Bot Auth signatures.
// Prints the private JWK to set as WEB_BOT_AUTH_PRIVATE_KEY (Vercel env + .env.local)
// and the public keyid. Never commit the private key.
// Usage: node scripts/generate-web-bot-auth-key.js
const { createHash, generateKeyPairSync } = require("crypto");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const priv = privateKey.export({ format: "jwk" });
const pub = publicKey.export({ format: "jwk" });
const keyid = createHash("sha256")
  .update(JSON.stringify({ crv: pub.crv, kty: pub.kty, x: pub.x }))
  .digest("base64url");

console.log("WEB_BOT_AUTH_PRIVATE_KEY=" + JSON.stringify(priv));
console.log("\npublic keyid (JWK thumbprint): " + keyid);
