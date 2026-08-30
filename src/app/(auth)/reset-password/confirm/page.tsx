"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

function ConfirmResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Verifying only happens on a real click, never on page load — email
  // safety scanners that prefetch this URL won't burn the one-time token.
  async function handleContinue() {
    if (!tokenHash || !type) {
      setError("This link is missing information — please request a new one.");
      setStatus("error");
      return;
    }

    setStatus("verifying");
    const { error: verifyError } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (verifyError) {
      setError(verifyError.message);
      setStatus("error");
      return;
    }

    router.push("/reset-password");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl text-cream mb-2">Reset password</h1>
        <p className="text-cream-muted mb-8">Click below to continue resetting your password.</p>

        {error && <p className="text-orange text-sm mb-6">{error}</p>}

        {status === "error" ? (
          <Link
            href="/forgot-password"
            className="inline-block w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition"
          >
            Request a new link
          </Link>
        ) : (
          <button
            onClick={handleContinue}
            disabled={status === "verifying"}
            className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
          >
            {status === "verifying" ? "Verifying…" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConfirmResetPage() {
  return (
    <Suspense>
      <ConfirmResetForm />
    </Suspense>
  );
}
