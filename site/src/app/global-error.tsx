"use client";

import { useEffect } from "react";

/**
 * Root error boundary (App Router convention: app/global-error.tsx).
 *
 * This one replaces the root layout when it renders, so it must supply its own
 * `<html>` and `<body>`, and it cannot rely on `globals.css` cascade layers or
 * Tailwind utilities — everything here is inline-styled on purpose.
 *
 * Retry uses this Next.js version's `unstable_retry` prop, not the older
 * `reset` name.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ece9e2",
          color: "#17202a",
          fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "34rem" }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "#b64235",
            }}
          >
            Error
          </p>
          <h1
            style={{
              margin: "2rem 0 0",
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "clamp(2.25rem, 9vw, 4rem)",
              fontWeight: 500,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            Unable to load the page.
          </h1>
          <p style={{ margin: "1.5rem 0 0", fontSize: "1rem", lineHeight: 1.75, color: "#5b6874" }}>
            Something broke before the page could be assembled. Try again — the rest of the site
            is unaffected.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "2rem",
              minHeight: "3rem",
              border: 0,
              borderRadius: "999px",
              backgroundColor: "#14343d",
              color: "#fff",
              padding: "0.9rem 2rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
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
