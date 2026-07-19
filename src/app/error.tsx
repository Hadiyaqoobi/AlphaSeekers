"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability/report";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportError(error, { digest: error.digest, boundary: "root" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif", margin: 0, padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900 }}>Something went wrong</h1>
        <p style={{ color: "#475569", fontSize: "0.875rem" }}>An unexpected error occurred. Please try again.</p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          <button onClick={() => reset()} style={{ padding: "0.5rem 1rem", borderRadius: "9999px", background: "#10b981", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
          <a href="/" style={{ padding: "0.5rem 1rem", borderRadius: "9999px", border: "1px solid #e2e8f0", textDecoration: "none", color: "#475569", fontWeight: 700 }}>
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
