"use client";

import { useRef } from "react";
import { useEqualizeCardHeights } from "@/lib/useEqualizeCardHeights";

export default function EqualHeightGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEqualizeCardHeights(ref, [children]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
