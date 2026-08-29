"use client";

import { useEffect, useState } from "react";

export type Theme = "auto" | "light" | "dark";
const KEY = "gatewatch:theme";

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "auto") el.removeAttribute("data-gw-theme");
  else el.setAttribute("data-gw-theme", t);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    let saved: Theme = "auto";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "auto") saved = v;
    } catch { /* private mode */ }
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const pick = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
  };

  return (
    <div className="seg" role="group" aria-label="Colour theme">
      {(["auto", "light", "dark"] as const).map((t) => (
        <button
          key={t}
          data-on={theme === t ? "1" : "0"}
          aria-pressed={theme === t}
          onClick={() => pick(t)}
        >
          {t === "auto" ? "AUTO" : t === "light" ? "DAY" : "NIGHT"}
        </button>
      ))}
    </div>
  );
}
