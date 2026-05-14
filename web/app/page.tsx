import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div className="wordmark" data-text="MINES" style={{ fontSize: 96 }}>
          MINES
        </div>
        <div
          className="mono upper"
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            letterSpacing: "0.32em",
          }}
        >
          hi-fi · phase 1
        </div>
        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <Link href="/play" className="btn btn-gold sparkle">
            ▶ play
          </Link>
        </div>
      </div>
    </main>
  );
}
