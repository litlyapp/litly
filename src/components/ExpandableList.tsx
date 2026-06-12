"use client";

import { useState } from "react";

// Collapses a long server-rendered list: shows `initial` items, and each
// click of the expander reveals `step` more
export default function ExpandableList({
  children,
  initial,
  step,
  className,
}: {
  children: React.ReactNode[];
  initial: number;
  step: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(initial);
  const items = children.slice(0, visible);
  const remaining = children.length - items.length;

  return (
    <div className={className}>
      {items}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + step)}
          className="w-full text-center text-orange text-sm font-medium py-3 hover:bg-cream/5 transition"
        >
          Show {Math.min(step, remaining)} more ({remaining} hidden)
        </button>
      )}
    </div>
  );
}
