import { ImageResponse } from "next/og";

export const alt = "TwoRing — The 24/7 AI receptionist for the trades";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social/ad share card. Rendered at build/request time by Satori, so
// styles are inline and layout is flexbox only.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <circle cx="12" cy="16" r="5" fill="#34d399" />
            <path d="M21 9.5a9 9 0 0 1 0 13" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M25 6a13.5 13.5 0 0 1 0 20" stroke="#34d399" strokeOpacity="0.55" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#fafafa" }}>
            <span>Two</span>
            <span style={{ color: "#34d399" }}>Ring</span>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: "#fafafa",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            Every missed call is a customer your competitor just won.
          </div>
          <div style={{ fontSize: 30, color: "#a1a1aa" }}>
            The 24/7 AI receptionist for the trades — answers, books, emails the lead.
          </div>
        </div>

        {/* footer chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#064e3b",
              color: "#a7f3d0",
              borderRadius: 999,
              padding: "10px 20px",
              fontSize: 24,
              fontWeight: 500,
            }}
          >
            ✓ Booked · Tuesday 2:00 PM
          </div>
          <div style={{ fontSize: 24, color: "#71717a" }}>
            First two weeks free · cancel anytime
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
