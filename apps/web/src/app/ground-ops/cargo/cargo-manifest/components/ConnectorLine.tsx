"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Point { x: number; y: number }

interface ConnectorLineProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  dotRef: HTMLButtonElement | null;
  dockRef: HTMLDivElement | null;
  accent: string;
}

type Side = "left" | "right" | "top" | "bottom";

export function ConnectorLine({ containerRef, dotRef, dockRef, accent }: ConnectorLineProps) {
  const [line, setLine] = useState<{ from: Point; to: Point; side: Side } | null>(null);
  const [pathKey, setPathKey] = useState(0);
  const prevDotRef = useRef<HTMLButtonElement | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !dotRef || !dockRef) { setLine(null); return; }

    const cRect = container.getBoundingClientRect();
    const dotRect = dotRef.getBoundingClientRect();
    const dockRect = dockRef.getBoundingClientRect();

    const from: Point = {
      x: dotRect.left + dotRect.width / 2 - cRect.left,
      y: dotRect.top + dotRect.height / 2 - cRect.top,
    };

    const dockCx = dockRect.left + dockRect.width / 2 - cRect.left;
    const dockCy = dockRect.top + dockRect.height / 2 - cRect.top;
    const edges: Point[] = [
      { x: dockRect.left - cRect.left, y: dockCy },
      { x: dockRect.right - cRect.left, y: dockCy },
      { x: dockCx, y: dockRect.top - cRect.top },
      { x: dockCx, y: dockRect.bottom - cRect.top },
    ];

    const sides = ["left", "right", "top", "bottom"] as const;
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < edges.length; i++) {
      const d = Math.hypot(edges[i].x - from.x, edges[i].y - from.y);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }

    setLine({ from, to: edges[nearestIdx], side: sides[nearestIdx] });
  }, [containerRef, dotRef, dockRef]);

  // Trigger fade animation when hold changes
  useEffect(() => {
    if (dotRef !== prevDotRef.current) {
      prevDotRef.current = dotRef;
      setPathKey((k) => k + 1);
    }
  }, [dotRef]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    const id = setInterval(measure, 500);
    return () => {
      window.removeEventListener("resize", measure);
      clearInterval(id);
    };
  }, [measure]);

  if (!line) return null;

  const { from, to, side } = line;

  let mid: Point;
  switch (side) {
    case "left":
      mid = { x: to.x - 30, y: to.y };
      break;
    case "right":
      mid = { x: to.x + 30, y: to.y };
      break;
    case "top":
      mid = { x: to.x, y: to.y - 30 };
      break;
    case "bottom":
      mid = { x: to.x, y: to.y + 30 };
      break;
  }
  const path = `M ${from.x} ${from.y} L ${mid.x} ${mid.y} L ${to.x} ${to.y}`;

  return (
    <svg
      className="absolute inset-0 z-[4] pointer-events-none"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      {/* Soft glow */}
      <path
        d={path}
        fill="none"
        stroke={accent}
        strokeWidth={8}
        strokeOpacity={0.06}
        strokeLinecap="round"
      />

      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={accent}
        strokeWidth={2}
        strokeOpacity={0.45}
        strokeLinecap="round"
      />

      {/* Endpoint dot */}
      <circle
        cx={to.x}
        cy={to.y}
        r={3}
        fill={accent}
        fillOpacity={0.3}
      />
    </svg>
  );
}
