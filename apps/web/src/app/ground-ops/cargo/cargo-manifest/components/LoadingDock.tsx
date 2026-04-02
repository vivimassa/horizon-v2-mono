import { forwardRef } from "react";
import { Package, GripHorizontal } from "lucide-react";
import type { DockItem } from "@/types/cargo";

interface LoadingDockProps {
  items: DockItem[];
  accent: string;
  isDark: boolean;
  position?: { x: number; y: number };
  onDragStart?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

export const LoadingDock = forwardRef<HTMLDivElement, LoadingDockProps>(
  function LoadingDock({ items, accent, isDark, position, onDragStart, isDragging }, ref) {
    const hasPosition = position !== undefined;

    return (
      <div
        ref={ref}
        className="absolute z-10"
        style={{
          ...(hasPosition
            ? { left: position.x, top: position.y }
            : { right: 12, top: "50%", transform: "translateY(calc(-50% + 20px))" }),
          width: 340,
          background: isDark ? "rgba(20,20,24,0.85)" : "rgba(255,255,255,0.65)",
          backdropFilter: "blur(20px)",
          borderRadius: 12,
          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)"}`,
          boxShadow: isDragging
            ? `0 12px 40px ${isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.14)"}`
            : `0 8px 32px ${isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.08)"}`,
          padding: "10px 12px",
          transition: isDragging ? "none" : "box-shadow 0.2s",
          userSelect: "none",
        }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="flex items-center justify-center py-0.5 -mt-1 mb-1 rounded"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          <GripHorizontal size={14} strokeWidth={1.5} style={{ color: isDark ? "#555" : "#c0c4ca" }} />
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <Package size={12} strokeWidth={2} style={{ color: accent }} />
          <span className="text-[11px] font-bold uppercase" style={{ color: isDark ? "#a1a1aa" : "#6b7280", letterSpacing: "0.5px" }}>
            Loading Dock
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto"
            style={{ background: `${accent}1a`, color: accent }}
          >
            {items.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg flex items-center gap-2"
              style={{
                padding: "6px 8px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)"}`,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate" style={{ color: isDark ? "#f5f5f5" : "#374151" }}>
                  {item.id}
                </div>
                <div className="text-[9px]" style={{ color: isDark ? "#71717a" : "#9ca3af" }}>
                  {item.weight} kg &middot; {item.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
