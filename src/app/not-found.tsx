// Renders only for paths outside of any [locale] route. Middleware
// redirects "/" to "/en" (or "/ko") so this is essentially never hit,
// but Next.js requires the file to exist at the app root.
export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main style={{ padding: "4rem", fontFamily: "system-ui" }}>
          <h1>404</h1>
          <p>Page not found.</p>
        </main>
      </body>
    </html>
  );
}
