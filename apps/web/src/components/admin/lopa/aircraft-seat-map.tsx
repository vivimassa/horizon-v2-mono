"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { CabinClassRef, CabinEntry } from "@skyhub/api";
import { useTheme } from "@/components/theme-provider";
import { modeColor } from "@skyhub/ui/theme";

interface AircraftSeatMapProps {
  cabins: CabinEntry[];
  cabinClasses: CabinClassRef[];
  aircraftType?: string;
}

// Cabin cutout region as % of the image (where seats go)
// Tuned for the fuselage template
const CABIN_REGION = {
  left: 14,
  right: 77,
  top: 35,
  bottom: 65,
};

interface CabinSection {
  classCode: string;
  color: string;
  name: string;
  seats: number;
  layout: number[];
  seatsPerRow: number;
  rows: number;
}

function parseSections(cabins: CabinEntry[], cabinClasses: CabinClassRef[]): CabinSection[] {
  // Sort by cabin class sortOrder so premium cabins render at front (nose)
  const sorted = [...cabins].sort((a, b) => {
    const aOrder = cabinClasses.find((c) => c.code === a.classCode)?.sortOrder ?? 99;
    const bOrder = cabinClasses.find((c) => c.code === b.classCode)?.sortOrder ?? 99;
    return aOrder - bOrder;
  });

  return sorted.map((cabin) => {
    const cc = cabinClasses.find((c) => c.code === cabin.classCode);
    const layout = (cc?.seatLayout || "3-3").split("-").map(Number);
    const seatsPerRow = layout.reduce((s, g) => s + g, 0);
    const rows = Math.ceil(cabin.seats / seatsPerRow);
    return {
      classCode: cabin.classCode,
      color: cc?.color || "#9ca3af",
      name: cc?.name || cabin.classCode,
      seats: cabin.seats,
      layout,
      seatsPerRow,
      rows,
    };
  });
}

const SEAT_GAP = 1.5;
const AISLE_W = 8;
const ROW_GAP = 2;
const CABIN_GAP = 4;

export function AircraftSeatMap({ cabins, cabinClasses, aircraftType }: AircraftSeatMapProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const panelBg = isDark ? "#1e1e22" : "#ffffff";
  const sections = useMemo(() => {
    const raw = parseSections(cabins, cabinClasses);
    return raw.map((s) => ({ ...s, color: modeColor(s.color, isDark) }));
  }, [cabins, cabinClasses, isDark]);
  const imgType = aircraftType?.toUpperCase() || "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset image state when aircraft type changes
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [imgType]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerW(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (sections.length === 0) {
    return <div className="text-[13px] text-hz-text-secondary py-4 text-center">No cabin data to display</div>;
  }

  if (!imgType || imgError) {
    return <FallbackSeatMap sections={sections} />;
  }

  // ── Image-based rendering ──
  const PAD = 2;
  const maxAbreast = Math.max(...sections.map((s) => s.seatsPerRow));
  const maxGroups = Math.max(...sections.map((s) => s.layout.length));
  const aisleCount = maxGroups - 1;

  const seatH = 10; // row depth
  const seatW = 8;  // seat width

  // Premium cabins get wider row gaps proportional to how few seats they have abreast
  // e.g. 1-1 (2 abreast) gets 3x row gap vs 3-3 (6 abreast) which gets 1x
  const getRowGap = (seatsPerRow: number) => {
    const ratio = maxAbreast / Math.max(1, seatsPerRow);
    return ROW_GAP + (ratio - 1) * seatH * 0.25;
  };

  const totalGaps = Math.max(0, sections.length - 1) * CABIN_GAP;
  const svgW = sections.reduce((w, sec) => {
    const gap = getRowGap(sec.seatsPerRow);
    const sh = sec.seatsPerRow <= 2 ? seatH * 1.2 : seatH;
    return w + sec.rows * (sh + gap);
  }, 0) + totalGaps + PAD * 2;
  const svgH = maxAbreast * (seatW + SEAT_GAP) + aisleCount * AISLE_W + PAD * 2;

  return (
    <div ref={containerRef} className="w-full relative rounded-xl overflow-hidden" style={{ backgroundColor: isDark ? "#ffffff" : undefined }}>
      {/* Aircraft fuselage image (transparent PNG — auto-provisioned per type) */}
      <img
        src={`/assets/aircraft/${imgType}/fuselage.png`}
        alt={`${imgType} fuselage`}
        className="w-full h-auto block"
        draggable={false}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
      />

      {/* Seats SVG overlay — stretched to fill the cabin cutout */}
      <svg
        className="absolute pointer-events-none"
        style={{
          left: `${CABIN_REGION.left}%`,
          top: `${CABIN_REGION.top}%`,
          width: `${CABIN_REGION.right - CABIN_REGION.left}%`,
          height: `${CABIN_REGION.bottom - CABIN_REGION.top}%`,
        }}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {(() => {
          const elements: React.ReactElement[] = [];
          let curX = PAD;
          const centerY = svgH / 2;

          for (let si = 0; si < sections.length; si++) {
            const sec = sections[si];

            // Compute seat width for THIS section to fill the full cabin height
            // Cap max seat width so premium cabins don't look absurdly stretched
            const secAbreast = sec.seatsPerRow;
            const secAisleCount = sec.layout.length - 1;
            const secAisleTotal = secAisleCount * AISLE_W;
            const maxSeatW = seatW * 1.3; // max ~30% wider than economy
            const rawSeatW = (svgH - PAD * 2 - secAisleTotal - (secAbreast - 1) * SEAT_GAP) / secAbreast;
            const secSeatW = Math.min(rawSeatW, maxSeatW);

            // Distribute remaining space as extra gap between seats
            const usedH = secAbreast * secSeatW + (secAbreast - 1) * SEAT_GAP + secAisleTotal;
            const extraGap = (svgH - PAD * 2 - usedH) / Math.max(1, secAbreast - 1 + secAisleCount);
            const secSeatGap = SEAT_GAP + extraGap;
            const secAisleW = AISLE_W + extraGap;

            const secRowGap = getRowGap(sec.seatsPerRow);
            // First class (1-1, 2 abreast) gets 1.2x seat depth
            const secSeatH = sec.seatsPerRow <= 2 ? seatH * 1.2 : seatH;

            for (let row = 0; row < sec.rows; row++) {
              const rowX = curX + row * (secSeatH + secRowGap);

              // Center the section vertically
              const totalUsed = secAbreast * secSeatW + (secAbreast - 1) * secSeatGap + secAisleCount * (secAisleW - secSeatGap);
              let seatY = (svgH - totalUsed) / 2;

              for (let g = 0; g < sec.layout.length; g++) {
                for (let s = 0; s < sec.layout[g]; s++) {
                  const seatIdx = row * sec.seatsPerRow + sec.layout.slice(0, g).reduce((a, b) => a + b, 0) + s;
                  const isActive = seatIdx < sec.seats;
                  const seatBackW = Math.round(secSeatH * 0.3);

                  elements.push(
                    <g key={`seat-${si}-${row}-${g}-${s}`} opacity={isActive ? 1 : 0.12}>
                      <rect x={rowX} y={seatY} width={secSeatH} height={secSeatW}
                        rx={1.2} fill={sec.color} opacity={0.2} stroke={sec.color} strokeWidth={0.4} />
                      <rect x={rowX + 0.4} y={seatY + 0.4} width={seatBackW} height={secSeatW - 0.8}
                        rx={0.8} fill={sec.color} opacity={0.5} />
                      <rect x={rowX + seatBackW + 0.4} y={seatY}
                        width={secSeatH - seatBackW - 1} height={0.6} rx={0.3} fill={sec.color} opacity={0.3} />
                      <rect x={rowX + seatBackW + 0.4} y={seatY + secSeatW - 0.6}
                        width={secSeatH - seatBackW - 1} height={0.6} rx={0.3} fill={sec.color} opacity={0.3} />
                    </g>
                  );
                  seatY += secSeatW + secSeatGap;
                }
                if (g < sec.layout.length - 1) {
                  seatY += secAisleW - secSeatGap;
                }
              }
            }

            curX += sec.rows * (secSeatH + secRowGap);

            if (si < sections.length - 1) {
              curX += CABIN_GAP;
            }
          }

          return elements;
        })()}
      </svg>
    </div>
  );
}

// ── SVG-only fallback ──
function FallbackSeatMap({ sections }: { sections: CabinSection[] }) {
  const SW = 8, SH = 7, PY = 14, NOSE = 40, TAIL = 30;

  const maxW = Math.max(...sections.map((s) => {
    const gw = s.layout.map((c) => c * SW + (c - 1) * SEAT_GAP);
    return gw.reduce((a, b) => a + b, 0) + (s.layout.length - 1) * AISLE_W;
  }));

  const totalRowsLen = sections.reduce((len, sec, i) =>
    len + sec.rows * (SH + ROW_GAP) + (i < sections.length - 1 ? CABIN_GAP : 0), 0);

  const fH = maxW + PY * 2;
  const totalW = NOSE + totalRowsLen + TAIL + 20;
  const totalH = fH + 36;
  const cY = totalH / 2;
  const fR = fH / 2;
  const bL = NOSE - 6;
  const bR = NOSE + totalRowsLen + 14;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} width="100%" style={{ maxHeight: 200 }}
        xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <rect x={bL} y={cY - fR} width={bR - bL} height={fH} rx={fR} fill="currentColor" className="text-hz-border/15" />
        <path d={`M ${bL + fR} ${cY - fR} C ${bL - 4} ${cY - fR}, 18 ${cY - fR * 0.55}, 6 ${cY} C 18 ${cY + fR * 0.55}, ${bL - 4} ${cY + fR}, ${bL + fR} ${cY + fR} Z`}
          fill="currentColor" className="text-hz-border/15" />
        {(() => {
          const el: React.ReactElement[] = [];
          let curX = NOSE + 10;
          for (let si = 0; si < sections.length; si++) {
            const sec = sections[si];
            const sW = sec.rows * (SH + ROW_GAP);
            el.push(
              <g key={`l-${si}`}>
                <line x1={curX} y1={cY - fR - 6} x2={curX + sW - ROW_GAP} y2={cY - fR - 6} stroke={sec.color} strokeWidth={1.5} opacity={0.5} />
                <text x={curX + (sW - ROW_GAP) / 2} y={cY - fR - 13} textAnchor="middle" fontSize={8} fontWeight={700} fill={sec.color}>{sec.name}</text>
              </g>
            );
            for (let row = 0; row < sec.rows; row++) {
              const rX = curX + row * (SH + ROW_GAP);
              // Center this section's seats vertically
              const secW = sec.layout.map((c) => c * SW + (c - 1) * SEAT_GAP).reduce((a, b) => a + b, 0) + (sec.layout.length - 1) * AISLE_W;
              let sY = cY - secW / 2;
              for (let g = 0; g < sec.layout.length; g++) {
                for (let s = 0; s < sec.layout[g]; s++) {
                  const idx = row * sec.seatsPerRow + sec.layout.slice(0, g).reduce((a, b) => a + b, 0) + s;
                  const bw = Math.round(SH * 0.3);
                  el.push(
                    <g key={`s-${si}-${row}-${g}-${s}`} opacity={idx < sec.seats ? 1 : 0.2}>
                      <rect x={rX} y={sY} width={SH} height={SW} rx={1.5} fill={sec.color} opacity={0.18} stroke={sec.color} strokeWidth={0.5} />
                      <rect x={rX + 0.5} y={sY + 0.5} width={bw} height={SW - 1} rx={1.5} fill={sec.color} opacity={0.45} />
                    </g>
                  );
                  sY += SW + SEAT_GAP;
                }
                if (g < sec.layout.length - 1) sY += AISLE_W - SEAT_GAP;
              }
            }
            curX += sW;
            if (si < sections.length - 1) curX += CABIN_GAP;
          }
          return el;
        })()}
      </svg>
    </div>
  );
}
