import { directoryResponseHeaders, publicKeyDirectory } from "@/lib/webBotAuth";

// Public key directory for the importer's Web Bot Auth signatures. Verifiers
// (e.g. Cloudflare) fetch this and check the response's own signature.
export async function GET(request: Request) {
  const authority = request.headers.get("host") ?? new URL(request.url).host;
  return new Response(JSON.stringify(publicKeyDirectory()), {
    headers: {
      "Content-Type": "application/http-message-signatures-directory+json",
      "Cache-Control": "public, max-age=300",
      ...directoryResponseHeaders(authority),
    },
  });
}
