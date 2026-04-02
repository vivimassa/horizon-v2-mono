"use client";

import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "@/components/theme-provider";

interface AirportMapProps {
  latitude: number;
  longitude: number;
  name: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function AirportMap({ latitude, longitude, name }: AirportMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [style, setStyle] = useState<"streets" | "satellite">("streets");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;

    const mapStyle =
      style === "satellite"
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : isDark
          ? "mapbox://styles/mapbox/dark-v11"
          : "mapbox://styles/mapbox/light-v11";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: TOKEN,
      style: mapStyle,
      center: [longitude, latitude],
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    // Ensure map fills container after tiles load
    map.on("load", () => map.resize());

    const marker = new mapboxgl.Marker({ color: "#2563eb" })
      .setLngLat([longitude, latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
          `<div style="font-size:13px;font-weight:600;padding:2px 4px">${name}</div>`
        )
      )
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
    };
  }, [latitude, longitude, name, style, isDark]);

  if (!TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-hz-card text-sm text-hz-text-secondary">
        Mapbox token not configured
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {/* Style toggle */}
      <button
        onClick={() => setStyle((s) => (s === "streets" ? "satellite" : "streets"))}
        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[13px] font-semibold shadow-sm hover:shadow-md transition-shadow backdrop-blur-md"
        style={{
          background: isDark ? "rgba(30,30,34,0.85)" : "rgba(255,255,255,0.9)",
          color: isDark ? "#e4e4e7" : "#333",
          border: `0.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"}`,
        }}
      >
        {style === "streets" ? "Satellite" : "Streets"}
      </button>
    </div>
  );
}
