"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0d0a07", color: "#e8dcc6", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h2 style={{ fontSize: 20 }}>Gate Watch hit an error</h2>
        <p style={{ color: "#b8a888", fontSize: 14 }}>The dashboard failed to render. Reload to try the feeds again.</p>
        <button
          onClick={() => reset()}
          style={{ marginTop: 12, padding: "10px 16px", borderRadius: 999, border: "1px solid rgba(214,178,120,.3)", background: "rgba(255,158,61,.14)", color: "#ffd9ac", fontSize: 14 }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
