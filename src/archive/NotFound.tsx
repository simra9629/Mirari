import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        textAlign: "center",
        padding: 24,
      }}
    >
      <span className="eyebrow">Nothing here</span>
      <h1 style={{ fontSize: "1.6rem" }}>This world hasn't been discovered yet.</h1>
      <Link
        to="/"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.8rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--mirari-periwinkle-pale)",
          border: "1px solid var(--mirari-periwinkle-deep)",
          borderRadius: 999,
          padding: "8px 16px",
        }}
      >
        Back to Mirari
      </Link>
    </div>
  );
}
