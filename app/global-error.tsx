"use client";

// Root error boundary — catches errors in the root layout itself. Must render
// its own <html>/<body>, and can't rely on the app's CSS, so it uses inline
// styles. Kept intentionally minimal.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f3ee",
          color: "#2a2826",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: 12, color: "#6b665f" }}>
            A temporary error occurred. Please try again.
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, fontSize: 12, color: "#9a948b" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20,
              border: "none",
              borderRadius: 4,
              padding: "12px 24px",
              background: "#bd5b3d",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
