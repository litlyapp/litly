"use client";

import { useEffect, useState } from "react";

type Mode = "android" | "ios" | "hidden";

export default function InstallButton({ variant = "hero" }: { variant?: "hero" | "footer" }) {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isIos) {
      setMode("ios");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void });
      setMode("android");
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (mode === "hidden") return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    setMode("hidden");
  }

  const baseClass = variant === "hero"
    ? "md:hidden border border-cream/25 text-cream-muted text-sm px-5 py-2 rounded-full hover:border-cream/50 hover:text-cream transition flex items-center gap-2"
    : "md:hidden text-cream-muted font-semibold hover:text-cream transition flex items-center gap-2";

  if (mode === "android") {
    return (
      <button onClick={handleInstall} className={baseClass}>
        <DownloadIcon />
        Add to home screen
      </button>
    );
  }

  // iOS
  return (
    <div className="md:hidden relative">
      <button
        onClick={() => setShowIosHint((v) => !v)}
        className={baseClass}
      >
        <DownloadIcon />
        Add to home screen
      </button>

      {showIosHint && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-navy-light border border-cream/20 rounded-2xl px-4 py-3 text-cream-muted text-xs w-56 text-center shadow-lg z-50">
          Tap <span className="text-cream">Share</span> <ShareIcon /> then
          {" "}<span className="text-cream">Add to Home Screen</span>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-navy-light border-r border-b border-cream/20 rotate-45" />
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-3.5 h-3.5 inline shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
