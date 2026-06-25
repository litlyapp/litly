"use client";

import { useState } from "react";

export default function ExpandableGrid({
  children,
  initial = 10,
  step = 10,
  className,
}: {
  children: React.ReactNode[];
  initial?: number;
  step?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(initial);
  const items = children.slice(0, visible);
  const remaining = children.length - items.length;

  return (
    <div>
      <div className={className}>{items}</div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + step)}
          className="w-full mt-4 text-center text-orange text-sm font-medium py-3 border border-cream/10 rounded-2xl hover:bg-cream/5 transition"
        >
          Show {Math.min(step, remaining)} more ({remaining} remaining)
        </button>
      )}
    </div>
  );
}
