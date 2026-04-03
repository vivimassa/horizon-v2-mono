"use client";

import { useMemo } from "react";

interface SeatRowPreviewProps {
  /** e.g. "3-3", "2-2", "1-2-1" */
  seatLayout: string;
  /** Hex color for seats */
  color: string;
  /** Seat type for styling */
  seatType?: "standard" | "premium" | "lie-flat" | "suite" | null;
  /** Pitch in inches (affects seat depth visual) */
  pitchIn?: number | null;
}

// Seat letters by position count
const SEAT_LETTERS_LEFT: Record<number, string[]> = {
  1: ["A"],
  2: ["A", "B"],
  3: ["A", "B", "C"],
  4: ["A", "B", "C", "D"],
};

const SEAT_LETTERS_RIGHT: Record<number, string[]> = {
  1: ["F"],
  2: ["E", "F"],
  3: ["D", "E", "F"],
  4: ["D", "E", "F", "G"],
};

// For 3-group layouts like 2-4-2 or 1-2-1
function getSeatLetters(groups: number[]): string[][] {
  if (groups.length === 2) {
    return [
      SEAT_LETTERS_LEFT[groups[0]] || Array.from({ length: groups[0] }, (_, i) => String.fromCharCode(65 + i)),
      SEAT_LETTERS_RIGHT[groups[1]] || Array.from({ length: groups[1] }, (_, i) => String.fromCharCode(68 + i)),
    ];
  }
  // 3 groups (e.g., 2-4-2 or 1-2-1)
  const all: string[][] = [];
  let charIdx = 0;
  for (const count of groups) {
    const letters: string[] = [];
    for (let i = 0; i < count; i++) {
      letters.push(String.fromCharCode(65 + charIdx));
      charIdx++;
    }
    all.push(letters);
  }
  return all;
}

export function SeatRowPreview({ seatLayout, color, seatType, pitchIn }: SeatRowPreviewProps) {
  const groups = useMemo(() => seatLayout.split("-").map(Number), [seatLayout]);
  const letters = useMemo(() => getSeatLetters(groups), [groups]);
  const totalSeatsPerRow = groups.reduce((s, g) => s + g, 0);

  // Dimensions
  const seatW = seatType === "suite" ? 48 : seatType === "lie-flat" ? 40 : seatType === "premium" ? 34 : 30;
  const seatH = seatType === "suite" ? 52 : seatType === "lie-flat" ? 44 : seatType === "premium" ? 36 : 32;
  const seatGap = 4;
  const aisleW = 28;
  const groupGap = aisleW;
  const padX = 32;
  const padY = 28;

  // Compute total width
  const groupWidths = groups.map((count) => count * seatW + (count - 1) * seatGap);
  const totalW = groupWidths.reduce((s, w) => s + w, 0) + (groups.length - 1) * groupGap + padX * 2;
  const totalH = seatH + padY * 2 + 20; // extra for letters

  // Generate seat positions
  const seats: { x: number; y: number; letter: string; groupIdx: number }[] = [];
  let curX = padX;

  for (let g = 0; g < groups.length; g++) {
    for (let s = 0; s < groups[g]; s++) {
      seats.push({
        x: curX + s * (seatW + seatGap),
        y: padY,
        letter: letters[g]?.[s] || "",
        groupIdx: g,
      });
    }
    curX += groupWidths[g] + groupGap;
  }

  // Seat corner radius
  const seatR = seatType === "suite" ? 6 : seatType === "lie-flat" ? 5 : 4;

  // Lighter fill for seat back
  const seatBackH = Math.round(seatH * 0.25);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        style={{ maxWidth: Math.min(totalW * 1.2, 500) }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Aisle label(s) */}
        {groups.length >= 2 && (() => {
          const aisles: React.ReactElement[] = [];
          let aX = padX;
          for (let g = 0; g < groups.length - 1; g++) {
            aX += groupWidths[g];
            const aisleCenter = aX + groupGap / 2;
            aisles.push(
              <g key={`aisle-${g}`}>
                {/* Aisle floor */}
                <rect
                  x={aX + 4}
                  y={padY - 2}
                  width={groupGap - 8}
                  height={seatH + 4}
                  rx={4}
                  fill="currentColor"
                  className="text-hz-border/30"
                />
                {/* Aisle dashes */}
                <line
                  x1={aisleCenter}
                  y1={padY + 4}
                  x2={aisleCenter}
                  y2={padY + seatH - 4}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  className="text-hz-text-tertiary/30"
                />
              </g>
            );
            aX += groupGap;
          }
          return aisles;
        })()}

        {/* Seats */}
        {seats.map((seat, i) => (
          <g key={i}>
            {/* Seat body */}
            <rect
              x={seat.x}
              y={seat.y}
              width={seatW}
              height={seatH}
              rx={seatR}
              fill={color}
              opacity={0.15}
              stroke={color}
              strokeWidth={1.5}
            />
            {/* Seat back (top portion, darker) */}
            <rect
              x={seat.x + 2}
              y={seat.y + 2}
              width={seatW - 4}
              height={seatBackH}
              rx={seatR - 1}
              fill={color}
              opacity={0.4}
            />
            {/* Armrests */}
            <rect
              x={seat.x - 1}
              y={seat.y + seatBackH + 4}
              width={2.5}
              height={seatH - seatBackH - 8}
              rx={1}
              fill={color}
              opacity={0.35}
            />
            <rect
              x={seat.x + seatW - 1.5}
              y={seat.y + seatBackH + 4}
              width={2.5}
              height={seatH - seatBackH - 8}
              rx={1}
              fill={color}
              opacity={0.35}
            />
            {/* Seat letter */}
            <text
              x={seat.x + seatW / 2}
              y={seat.y + seatH + 14}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fontFamily="ui-monospace, monospace"
              fill="currentColor"
              className="text-hz-text-secondary"
            >
              {seat.letter}
            </text>
          </g>
        ))}
      </svg>

      {/* Layout label */}
      <div className="flex items-center gap-3 text-[12px] text-hz-text-secondary">
        <span>
          Layout: <span className="font-bold font-mono" style={{ color }}>{seatLayout}</span>
        </span>
        <span className="text-hz-border">·</span>
        <span>{totalSeatsPerRow} abreast</span>
        {pitchIn && (
          <>
            <span className="text-hz-border">·</span>
            <span>{pitchIn}" pitch</span>
          </>
        )}
      </div>
    </div>
  );
}
