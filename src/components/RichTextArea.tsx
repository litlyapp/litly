"use client";

import { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

// A plain textarea plus a small Bold/Italic toolbar that wraps the current
// selection in **bold**/*italic* markers — rendered back out by renderRichText
// wherever this text is displayed publicly. Cmd/Ctrl+B and Cmd/Ctrl+I do the
// same thing as the buttons, matching the familiar GitHub-comment-box pattern.
export default function RichTextArea({ value, onChange, placeholder, rows = 6, className = "" }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function toggleMarker(marker: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: rawStart, selectionEnd: rawEnd } = el;
    const rawSelected = value.slice(rawStart, rawEnd);
    // Trim whitespace off the selection edges so the markers land directly
    // against real content — a marker with whitespace touching it (e.g.
    // "* Lars Anderson*") is deliberately NOT treated as emphasis by the
    // renderer, to avoid misreading a stray literal asterisk elsewhere.
    const leadingWs = rawSelected.match(/^\s*/)?.[0] ?? "";
    const trailingWs = rawSelected.length > leadingWs.length ? rawSelected.match(/\s*$/)?.[0] ?? "" : "";
    const start = rawStart + leadingWs.length;
    const end = rawEnd - trailingWs.length;
    const selected = value.slice(start, end);
    const m = marker.length;

    const alreadyWrapped =
      selected.length > 0 &&
      value.slice(start - m, start) === marker &&
      value.slice(end, end + m) === marker;

    let next: string;
    let newStart: number;
    let newEnd: number;

    if (alreadyWrapped) {
      // Unwrap: strip the markers just outside the selection
      next = value.slice(0, start - m) + selected + value.slice(end + m);
      newStart = start - m;
      newEnd = end - m;
    } else if (selected.length > 0) {
      next = value.slice(0, start) + marker + selected + marker + value.slice(end);
      newStart = start + m;
      newEnd = end + m;
    } else {
      // No selection — insert an empty pair and place the cursor between them
      next = value.slice(0, start) + marker + marker + value.slice(end);
      newStart = start + m;
      newEnd = start + m;
    }

    onChange(next);
    // Restore selection after the controlled value re-renders
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey; // Cmd on Mac, Ctrl on Windows/Linux
    if (!mod) return;
    if (e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleMarker("**");
    } else if (e.key.toLowerCase() === "i") {
      e.preventDefault();
      toggleMarker("*");
    }
  }

  const toolbarButtonClass =
    "w-7 h-7 flex items-center justify-center rounded-md border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition text-sm";

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          type="button"
          aria-label="Bold"
          title="Bold (Cmd/Ctrl+B)"
          className={`${toolbarButtonClass} font-bold`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMarker("**")}
        >
          B
        </button>
        <button
          type="button"
          aria-label="Italic"
          title="Italic (Cmd/Ctrl+I)"
          className={`${toolbarButtonClass} italic`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMarker("*")}
        >
          I
        </button>
      </div>
      <textarea
        ref={ref}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={className}
      />
    </div>
  );
}
