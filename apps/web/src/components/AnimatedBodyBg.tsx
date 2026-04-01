"use client";

import { useEffect, useState } from "react";

const PRESETS = ["aurora", "ember", "lagoon", "prism"] as const;
type Preset = (typeof PRESETS)[number] | "none";

/**
 * Applies the animated background CSS classes to <body>.
 * Reads preset from localStorage so it persists across sessions.
 */
export function AnimatedBodyBg() {
  const [preset, setPreset] = useState<Preset>("aurora");

  useEffect(() => {
    const saved = localStorage.getItem("skyhub-bg-preset");
    if (saved && [...PRESETS, "none"].includes(saved)) {
      setPreset(saved as Preset);
    }
  }, []);

  useEffect(() => {
    const body = document.body;
    // Remove any existing anim classes
    body.classList.remove("anim-bg");
    PRESETS.forEach((p) => body.classList.remove(`anim-bg-${p}`));

    if (preset !== "none") {
      body.classList.add("anim-bg", `anim-bg-${preset}`);
    }

    return () => {
      body.classList.remove("anim-bg");
      PRESETS.forEach((p) => body.classList.remove(`anim-bg-${p}`));
    };
  }, [preset]);

  return null;
}
