"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "@/components/theme-provider";

interface CityPairMapProps {
  lat1: number;
  lon1: number;
  lat2: number;
  lon2: number;
  label1: string;
  label2: string;
  distanceNm?: number | null;
  distanceKm?: number | null;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Haversine great circle intermediate points → [lon, lat] */
function greatCirclePoints(
  lat1: number, lon1: number, lat2: number, lon2: number, n = 100
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1r = toRad(lat1), lon1r = toRad(lon1);
  const lat2r = toRad(lat2), lon2r = toRad(lon2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat1r - lat2r) / 2) ** 2 +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.sin((lon1r - lon2r) / 2) ** 2
  ));
  if (d === 0) return [[lon1, lat1]];
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1r) * Math.cos(lon1r) + B * Math.cos(lat2r) * Math.cos(lon2r);
    const y = A * Math.cos(lat1r) * Math.sin(lon1r) + B * Math.cos(lat2r) * Math.sin(lon2r);
    const z = A * Math.sin(lat1r) + B * Math.sin(lat2r);
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts;
}

// ── Ping-pong glow SVG overlay ──
const GLOW_SPEED = 80;
const GLOW_FRACTION = 0.12;
const PAUSE_MS = 250;

function PingPongGlow({ map, points, color }: { map: mapboxgl.Map; points: [number, number][]; color: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!map || !svgRef.current || points.length < 2) return;
    const svg = svgRef.current;
    let cancelled = false;
    let animId = 0;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Defs
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const fadeGrad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    fadeGrad.setAttribute("id", "routeFade");
    fadeGrad.setAttribute("gradientUnits", "userSpaceOnUse");
    [
      { offset: "0%", opacity: "0" }, { offset: "12%", opacity: "1" },
      { offset: "88%", opacity: "1" }, { offset: "100%", opacity: "0" },
    ].forEach(s => {
      const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop.setAttribute("offset", s.offset);
      stop.setAttribute("stop-color", color);
      stop.setAttribute("stop-opacity", s.opacity);
      fadeGrad.appendChild(stop);
    });
    defs.appendChild(fadeGrad);
    svg.appendChild(defs);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Static route line (faded at ends)
    const staticPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    staticPath.setAttribute("fill", "none");
    staticPath.setAttribute("stroke", "url(#routeFade)");
    staticPath.setAttribute("stroke-opacity", "0.25");
    staticPath.setAttribute("stroke-width", "1.5");
    staticPath.setAttribute("stroke-linejoin", "round");
    g.appendChild(staticPath);

    // Glow path
    const glowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    glowPath.setAttribute("fill", "none");
    glowPath.setAttribute("stroke", color);
    glowPath.setAttribute("stroke-width", "2.5");
    glowPath.setAttribute("stroke-linecap", "round");
    glowPath.setAttribute("stroke-linejoin", "round");
    glowPath.style.filter = `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`;
    g.appendChild(glowPath);

    svg.appendChild(g);

    let totalLength = 0;
    let glowLen = 0;

    function buildPath() {
      const projected = points.map(([lng, lat]) => {
        const pt = map.project([lng, lat]);
        return [pt.x, pt.y] as [number, number];
      });
      const d = "M" + projected.map(([x, y]) => `${x},${y}`).join("L");
      staticPath.setAttribute("d", d);
      glowPath.setAttribute("d", d);

      if (projected.length >= 2) {
        fadeGrad.setAttribute("x1", String(projected[0][0]));
        fadeGrad.setAttribute("y1", String(projected[0][1]));
        fadeGrad.setAttribute("x2", String(projected[projected.length - 1][0]));
        fadeGrad.setAttribute("y2", String(projected[projected.length - 1][1]));
      }

      totalLength = glowPath.getTotalLength();
      if (totalLength > 0) {
        glowLen = totalLength * GLOW_FRACTION;
        glowPath.setAttribute("stroke-dasharray", `${glowLen} ${totalLength - glowLen}`);
      }
    }

    buildPath();

    let phase: "fwd" | "pause-b" | "rev" | "pause-a" = "fwd";
    let progress = 0;
    let pauseRemaining = 0;
    let lastTime = performance.now();

    function animate(time: number) {
      if (cancelled) return;
      const delta = time - lastTime;
      lastTime = time;

      if (totalLength <= 0) { animId = requestAnimationFrame(animate); return; }

      if (phase === "pause-b" || phase === "pause-a") {
        pauseRemaining -= delta;
        if (pauseRemaining <= 0) {
          phase = phase === "pause-b" ? "rev" : "fwd";
          progress = 0;
        }
      } else {
        const step = (delta / 1000) * GLOW_SPEED / totalLength;
        progress = Math.min(progress + step, 1);

        if (phase === "fwd") {
          glowPath.setAttribute("stroke-dashoffset", String(-progress * totalLength));
        } else {
          glowPath.setAttribute("stroke-dashoffset", String(-(1 - progress) * totalLength));
        }

        if (progress >= 1) {
          phase = phase === "fwd" ? "pause-b" : "pause-a";
          pauseRemaining = PAUSE_MS;
        }
      }

      animId = requestAnimationFrame(animate);
    }

    animId = requestAnimationFrame(animate);

    const handler = () => buildPath();
    map.on("move", handler);
    map.on("zoom", handler);
    map.on("resize", handler);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      map.off("move", handler);
      map.off("zoom", handler);
      map.off("resize", handler);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    };
  }, [map, points, color]);

  return (
    <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible", zIndex: 1 }} />
  );
}

// ── Main component ──

export function CityPairMap({ lat1, lon1, lat2, lon2, label1, label2, distanceNm, distanceKm }: CityPairMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [style, setStyle] = useState<"streets" | "satellite">("streets");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const accent = isDark ? "#60a5fa" : "#3b82f6";

  const gcPoints = useMemo(() => greatCirclePoints(lat1, lon1, lat2, lon2), [lat1, lon1, lat2, lon2]);

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;

    const mapStyle = style === "satellite"
      ? "mapbox://styles/mapbox/satellite-streets-v12"
      : isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: TOKEN,
      style: mapStyle,
      center: [(lon1 + lon2) / 2, (lat1 + lat2) / 2],
      zoom: 3,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    const ro = new ResizeObserver(() => requestAnimationFrame(() => map.resize()));
    if (wrapperRef.current) ro.observe(wrapperRef.current);

    map.on("load", () => {
      map.resize();

      // Station markers with labels
      const markerColor = isDark ? "#60a5fa" : "#3b82f6";

      [{ lon: lon1, lat: lat1, label: label1 }, { lon: lon2, lat: lat2, label: label2 }].forEach(({ lon, lat, label }) => {
        const el = document.createElement("div");
        el.style.cssText = "display:flex;flex-direction:column;align-items:center;";
        el.innerHTML = `
          <div style="width:16px;height:16px;background:${markerColor};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
          <span style="margin-top:4px;padding:1px 6px;border-radius:8px;font-size:13px;font-weight:700;color:white;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);white-space:nowrap;">${label}</span>
        `;
        new mapboxgl.Marker({ element: el, anchor: "top" }).setLngLat([lon, lat]).addTo(map);
      });

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lon1, lat1]);
      bounds.extend([lon2, lat2]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 800 });
    });

    setMapInstance(map);

    return () => { ro.disconnect(); map.remove(); setMapInstance(null); };
  }, [lat1, lon1, lat2, lon2, label1, label2, style, isDark]);

  if (!TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-hz-card text-[14px] text-hz-text-secondary">
        Mapbox token not configured
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Animated route glow overlay */}
      {mapInstance && <PingPongGlow map={mapInstance} points={gcPoints} color={accent} />}

      {/* Distance overlay */}
      {distanceNm != null && (
        <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2" style={{ zIndex: 2 }}>
          <span className="px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
            style={{ background: isDark ? "rgba(30,30,34,0.85)" : "rgba(255,255,255,0.88)", color: isDark ? "#e4e4e7" : "#111", border: `0.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            {distanceNm.toLocaleString()} nm
          </span>
          {distanceKm != null && (
            <span className="px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
              style={{ background: isDark ? "rgba(30,30,34,0.85)" : "rgba(255,255,255,0.88)", color: isDark ? "#e4e4e7" : "#111", border: `0.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              {distanceKm.toLocaleString()} km
            </span>
          )}
        </div>
      )}

      {/* Style toggle */}
      <button
        onClick={() => setStyle(s => s === "streets" ? "satellite" : "streets")}
        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[13px] font-semibold shadow-sm hover:shadow-md transition-shadow backdrop-blur-md"
        style={{ background: isDark ? "rgba(30,30,34,0.85)" : "rgba(255,255,255,0.9)", color: isDark ? "#e4e4e7" : "#333", border: `0.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"}`, zIndex: 2 }}>
        {style === "streets" ? "Satellite" : "Streets"}
      </button>
    </div>
  );
}
