export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif", margin: 0, padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900 }}>Page not found</h1>
        <p style={{ color: "#475569", fontSize: "0.875rem" }}>The page you are looking for does not exist.</p>
        <a href="/" style={{ display: "inline-block", marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: "9999px", background: "#10b981", color: "white", textDecoration: "none", fontWeight: 700 }}>
          Go home
        </a>
      </body>
    </html>
  );
}
