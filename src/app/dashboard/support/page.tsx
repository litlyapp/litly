"use client";

import { useState } from "react";
import Link from "next/link";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });

      if (res.ok) {
        setStatus("sent");
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <Link href="/dashboard" className="text-cream-muted text-sm hover:text-cream transition">
          ← Back to dashboard
        </Link>
        <h1 className="font-serif text-4xl text-cream mt-4 mb-1">Contact Support</h1>
        <p className="text-cream-muted text-sm">
          Having trouble posting or editing an event? Send us a message and we'll get back to you.
        </p>
      </div>

      {status === "sent" ? (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 text-center">
          <p className="font-serif text-2xl text-cream mb-2">Message sent</p>
          <p className="text-cream-muted text-sm mb-6">We'll follow up at your account email.</p>
          <button
            onClick={() => setStatus("idle")}
            className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition"
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What do you need help with?"
              required
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
            />
          </div>

          <div>
            <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue in as much detail as possible…"
              required
              rows={6}
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange resize-none"
            />
          </div>

          {status === "error" && (
            <p className="text-red-400 text-sm">Something went wrong — please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="px-6 py-2.5 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
